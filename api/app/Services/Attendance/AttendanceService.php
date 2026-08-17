<?php

namespace App\Services\Attendance;

use App\Models\AttendanceAdjustment;
use App\Models\AttendanceExclusion;
use App\Models\AttendanceLog;
use App\Models\AttendanceQrSetting;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Support\Authorization\AttendancePermission;
use App\Support\Tenancy\TenantContext;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator as Paginator;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttendanceService
{
    public const MIN_CHECKOUT_GAP_MINUTES = 5;

    /** @var array<string, Collection<int, array<string, mixed>>> */
    protected array $rosterMemo = [];

    public function overview(string $date, ?int $branchId = null): array
    {
        AttendancePermission::for()->assertCanViewAny();
        $roster = $this->roster($date, $branchId);

        return [
            'dashboard' => $this->statsFromRoster($roster),
            'shifts' => $this->shiftCardsFromRoster($date, $roster),
        ];
    }

    public function dashboard(string $date, ?int $branchId = null): array
    {
        AttendancePermission::for()->assertCanViewAny();

        return $this->statsFromRoster($this->roster($date, $branchId));
    }

    public function shiftsToday(string $date, ?int $branchId = null): array
    {
        AttendancePermission::for()->assertCanViewAny();

        return $this->shiftCardsFromRoster($date, $this->roster($date, $branchId));
    }

    public function list(array $filters): LengthAwarePaginator
    {
        AttendancePermission::for()->assertCanViewAny();

        [$start, $end] = $this->parseDateRange($filters);
        $branchId = ! empty($filters['branch_id']) ? (int) $filters['branch_id'] : null;
        $shiftId = ! empty($filters['shift_id']) ? (int) $filters['shift_id'] : null;
        $status = $filters['status'] ?? null;
        $search = trim((string) ($filters['search'] ?? ''));
        $perPage = max(1, (int) ($filters['per_page'] ?? 10));
        $page = max(1, (int) ($filters['page'] ?? 1));

        $query = AttendanceLog::query()
            ->with(['employee.position', 'employee.branches', 'shift', 'branch'])
            ->where('work_date', '>=', $start->toDateString())
            ->where('work_date', '<', $end->copy()->addDay()->toDateString());

        $this->scopeVisibleLogs($query, $branchId, $start, $end);

        if ($shiftId) {
            $query->where('shift_id', $shiftId);
        }

        if (is_string($status) && $status !== '') {
            $this->scopeUiStatus($query, $status);
        }

        if ($search !== '') {
            $like = '%'.addcslashes($search, '%_\\').'%';
            $query->whereHas('employee', function (Builder $employeeQuery) use ($like) {
                $employeeQuery->where(function (Builder $inner) use ($like) {
                    $inner->where('full_name', 'like', $like)
                        ->orWhere('employee_code', 'like', $like)
                        ->orWhereHas('position', fn (Builder $position) => $position->where('name', 'like', $like));
                });
            });
        }

        $paginator = $query
            ->orderByDesc('work_date')
            ->orderBy('employee_id')
            ->paginate($perPage, ['*'], 'page', $page);

        $items = collect($paginator->items())->map(function (AttendanceLog $log) use ($branchId) {
            return $this->buildRowPayload(
                $log->employee,
                $log,
                $log->shift,
                $log->work_date?->toDateString() ?? now()->toDateString(),
                $branchId
            );
        })->values();

        return new Paginator(
            $items,
            $paginator->total(),
            $paginator->perPage(),
            $paginator->currentPage(),
            ['path' => request()->url(), 'query' => request()->query()]
        );
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    public function mine(array $filters): Collection
    {
        AttendancePermission::for()->assertCanViewAny();
        $own = AttendancePermission::for()->ownEmployee();
        if (! $own) {
            return collect();
        }

        [$start, $end] = $this->parseDateRange($filters);

        return AttendanceLog::query()
            ->with(['employee.position', 'employee.branches', 'shift', 'branch'])
            ->where('employee_id', $own->id)
            ->where('work_date', '>=', $start->toDateString())
            ->where('work_date', '<', $end->copy()->addDay()->toDateString())
            ->orderByDesc('work_date')
            ->orderBy('id')
            ->get()
            ->map(fn (AttendanceLog $log) => $this->buildRowPayload(
                $log->employee,
                $log,
                $log->shift,
                $log->work_date?->toDateString() ?? now()->toDateString()
            ))
            ->values();
    }

    public function findOrFail(int $id): AttendanceLog
    {
        $log = AttendanceLog::query()->with(['employee.position', 'shift', 'branch'])->findOrFail($id);
        AttendancePermission::for()->assertCanViewLog($log);

        return $log;
    }

    public function checkIn(array $data): AttendanceLog
    {
        $permission = AttendancePermission::for();
        $employee = Employee::query()->findOrFail((int) $data['employee_id']);
        $branchId = (int) $data['branch_id'];
        $permission->assertCanCheckFor($employee, $branchId);
        $branch = Branch::query()->findOrFail($branchId);

        $source = (string) ($data['source'] ?? 'admin');
        $this->assertStaffSelfServiceAllowed($permission, $branchId, 'check_in', $source);
        $this->assertGeofence(
            $branch,
            isset($data['latitude']) ? (float) $data['latitude'] : null,
            isset($data['longitude']) ? (float) $data['longitude'] : null,
            $this->shouldEnforceLocation($permission, $source),
        );

        $date = $data['work_date'] ?? now()->toDateString();
        $this->assertNotOnLeave((int) $employee->id, $date);
        $checkInAt = isset($data['check_in_time']) && $data['check_in_time']
            ? Carbon::parse($date.' '.$data['check_in_time'])
            : now();

        return DB::transaction(function () use ($data, $employee, $branchId, $date, $checkInAt) {
            $existing = AttendanceLog::query()
                ->where('employee_id', $employee->id)
                ->where('branch_id', $branchId)
                ->whereDate('work_date', $date)
                ->lockForUpdate()
                ->first();

            if ($existing && $existing->status === AttendanceLog::STATUS_LEAVE) {
                throw ValidationException::withMessages([
                    'employee_id' => ['Nhân viên đang nghỉ phép ngày này.'],
                ]);
            }

            if ($existing && $existing->check_in_at) {
                throw ValidationException::withMessages([
                    'employee_id' => ['Nhân viên đã check-in hôm nay.'],
                ]);
            }

            $shiftId = $data['shift_id'] ?? null;
            if (! $shiftId) {
                $shiftId = ShiftAssignment::query()
                    ->where('employee_id', $employee->id)
                    ->where('branch_id', $branchId)
                    ->whereDate('date', $date)
                    ->where('status', ShiftAssignment::STATUS_ASSIGNED)
                    ->value('shift_id');
            }

            $payload = [
                'organization_id' => TenantContext::id(),
                'branch_id' => $branchId,
                'employee_id' => $employee->id,
                'shift_id' => $shiftId,
                'work_date' => $date,
                'check_in_at' => $checkInAt,
                'status' => AttendanceLog::STATUS_WORKING,
                'location_label' => $data['location_label'] ?? null,
                'check_in_latitude' => $data['latitude'] ?? null,
                'check_in_longitude' => $data['longitude'] ?? null,
                'device' => $data['device'] ?? request()->userAgent(),
                'created_by' => auth()->id(),
            ];

            if ($existing) {
                $existing->fill($payload)->save();

                return $existing->fresh(['employee.position', 'shift', 'branch']);
            }

            return AttendanceLog::query()->create($payload)->load(['employee.position', 'shift', 'branch']);
        });
    }

    public function checkOut(array $data): AttendanceLog
    {
        $permission = AttendancePermission::for();
        $employee = Employee::query()->findOrFail((int) $data['employee_id']);
        $branchId = (int) $data['branch_id'];
        $permission->assertCanCheckFor($employee, $branchId);
        $branch = Branch::query()->findOrFail($branchId);

        $source = (string) ($data['source'] ?? 'admin');
        $this->assertStaffSelfServiceAllowed($permission, $branchId, 'check_out', $source);
        $this->assertGeofence(
            $branch,
            isset($data['latitude']) ? (float) $data['latitude'] : null,
            isset($data['longitude']) ? (float) $data['longitude'] : null,
            $this->shouldEnforceLocation($permission, $source),
        );

        $date = $data['work_date'] ?? now()->toDateString();
        $checkOutAt = isset($data['check_out_time']) && $data['check_out_time']
            ? Carbon::parse($date.' '.$data['check_out_time'])
            : now();

        return DB::transaction(function () use ($data, $employee, $branchId, $date, $checkOutAt) {
            $log = AttendanceLog::query()
                ->where('employee_id', $employee->id)
                ->where('branch_id', $branchId)
                ->whereDate('work_date', $date)
                ->lockForUpdate()
                ->first();

            if (! $log || ! $log->check_in_at) {
                throw ValidationException::withMessages([
                    'employee_id' => ['Nhân viên chưa check-in.'],
                ]);
            }

            if ($log->check_out_at) {
                throw ValidationException::withMessages([
                    'employee_id' => ['Nhân viên đã check-out.'],
                ]);
            }

            if ($checkOutAt->lte($log->check_in_at)) {
                throw ValidationException::withMessages([
                    'check_out_time' => ['Giờ ra phải sau giờ vào.'],
                ]);
            }

            $earliest = $log->check_in_at->copy()->addMinutes(self::MIN_CHECKOUT_GAP_MINUTES);
            if ($checkOutAt->lt($earliest)) {
                $wait = max(1, (int) ceil($checkOutAt->diffInSeconds($earliest) / 60));
                throw ValidationException::withMessages([
                    'check_out_time' => [
                        'Check-out phải cách check-in ít nhất '.self::MIN_CHECKOUT_GAP_MINUTES
                        .' phút (còn khoảng '.$wait.' phút).',
                    ],
                ]);
            }

            $break = (int) ($data['break_minutes'] ?? $log->break_minutes ?? 0);
            $total = max(0, $log->check_in_at->diffInMinutes($checkOutAt) - $break);

            $log->forceFill([
                'check_out_at' => $checkOutAt,
                'break_minutes' => $break,
                'total_minutes' => $total,
                'status' => AttendanceLog::STATUS_CHECKED_OUT,
                'check_out_latitude' => $data['latitude'] ?? null,
                'check_out_longitude' => $data['longitude'] ?? null,
                'note' => $data['note'] ?? $log->note,
                'location_label' => $data['location_label'] ?? $log->location_label,
            ])->save();

            return $log->fresh(['employee.position', 'shift', 'branch']);
        });
    }

    /**
     * Trạng thái chấm công + quyền nút app nhân viên theo cấu hình QR chi nhánh.
     *
     * @return array<string, mixed>
     */
    public function staffCheckStatus(?int $branchId = null): array
    {
        $permission = AttendancePermission::for();
        $permission->assertCanViewAny();
        $own = $permission->ownEmployee();
        if (! $own) {
            throw ValidationException::withMessages([
                'employee' => ['Tài khoản chưa gắn hồ sơ nhân viên.'],
            ]);
        }

        $own->loadMissing('branches');
        $branch = null;
        if ($branchId) {
            $branch = $own->branches->firstWhere('id', $branchId);
        }
        $branch ??= $own->branches->firstWhere('pivot.is_primary', true)
            ?? $own->branches->first();

        if (! $branch) {
            throw ValidationException::withMessages([
                'branch_id' => ['Nhân viên chưa được gán chi nhánh.'],
            ]);
        }

        $setting = AttendanceQrSetting::query()->firstOrCreate(
            [
                'organization_id' => TenantContext::id(),
                'branch_id' => $branch->id,
            ],
            [
                'enabled' => true,
                'rotate_seconds' => 30,
                'valid_from' => '00:00',
                'valid_to' => '23:59',
                'allow_check_in' => true,
                'allow_check_out' => true,
            ]
        );

        $now = Carbon::now('Asia/Ho_Chi_Minh');
        $today = $now->toDateString();
        $log = AttendanceLog::query()
            ->where('employee_id', $own->id)
            ->where('branch_id', $branch->id)
            ->whereDate('work_date', $today)
            ->first();

        $withinHours = $this->qrWithinHours($setting, $now);
        $staffButtonsEnabled = (bool) $setting->enabled && $withinHours;
        $hasCoords = $branch->latitude !== null && $branch->longitude !== null;
        $checkedIn = (bool) $log?->check_in_at;
        $checkedOut = (bool) $log?->check_out_at;

        $checkoutAvailableAt = null;
        $secondsUntilCheckout = null;
        if ($checkedIn && ! $checkedOut && $log?->check_in_at) {
            $earliest = $log->check_in_at->copy()->addMinutes(self::MIN_CHECKOUT_GAP_MINUTES);
            $checkoutAvailableAt = $earliest->toIso8601String();
            $secondsUntilCheckout = $earliest->greaterThan($now)
                ? (int) $now->diffInSeconds($earliest)
                : 0;
        }

        $canCheckIn = $staffButtonsEnabled
            && (bool) $setting->allow_check_in
            && ! $checkedIn;

        $canCheckOut = $staffButtonsEnabled
            && (bool) $setting->allow_check_out
            && $checkedIn
            && ! $checkedOut
            && ($secondsUntilCheckout === null || $secondsUntilCheckout === 0);

        return [
            'employee_id' => $own->id,
            'branch' => [
                'id' => $branch->id,
                'name' => $branch->name,
                'address' => $branch->address,
                'latitude' => $branch->latitude,
                'longitude' => $branch->longitude,
                'check_in_radius_meters' => (int) ($branch->check_in_radius_meters ?: 100),
            ],
            'qr_enabled' => (bool) $setting->enabled,
            'allow_check_in' => (bool) $setting->allow_check_in,
            'allow_check_out' => (bool) $setting->allow_check_out,
            'valid_from' => $setting->valid_from,
            'valid_to' => $setting->valid_to,
            'within_hours' => $withinHours,
            'geofence' => [
                'required' => $hasCoords,
                'has_coordinates' => $hasCoords,
                'radius_meters' => (int) ($branch->check_in_radius_meters ?: 100),
            ],
            'min_checkout_gap_minutes' => self::MIN_CHECKOUT_GAP_MINUTES,
            'today' => [
                'work_date' => $today,
                'check_in' => $log?->check_in_at?->timezone('Asia/Ho_Chi_Minh')->format('H:i'),
                'check_out' => $log?->check_out_at?->timezone('Asia/Ho_Chi_Minh')->format('H:i'),
                'ui_status' => $checkedOut
                    ? 'checked_out'
                    : ($checkedIn ? 'working' : 'not_checked_in'),
                'can_check_in' => $canCheckIn,
                'can_check_out' => $canCheckOut,
                'checkout_available_at' => $checkoutAvailableAt,
                'seconds_until_checkout' => $secondsUntilCheckout,
            ],
            'branches' => $own->branches->map(fn (Branch $b) => [
                'id' => $b->id,
                'name' => $b->name,
                'is_primary' => (bool) $b->pivot->is_primary,
            ])->values()->all(),
        ];
    }

    protected function shouldEnforceLocation(AttendancePermission $permission, string $source): bool
    {
        return $permission->isEmployeeOnly()
            || in_array($source, ['qr', 'staff_app'], true);
    }

    protected function assertStaffSelfServiceAllowed(
        AttendancePermission $permission,
        int $branchId,
        string $action,
        string $source,
    ): void {
        if (! $permission->isEmployeeOnly() && $source !== 'staff_app') {
            return;
        }

        $setting = AttendanceQrSetting::query()
            ->where('branch_id', $branchId)
            ->first();

        if (! $setting || ! $setting->enabled) {
            throw ValidationException::withMessages([
                'branch_id' => ['Chi nhánh chưa bật chấm công trên app nhân viên (cấu hình QR).'],
            ]);
        }

        $now = Carbon::now('Asia/Ho_Chi_Minh');
        if (! $this->qrWithinHours($setting, $now)) {
            throw ValidationException::withMessages([
                'branch_id' => ['Ngoài khung giờ chấm công của chi nhánh.'],
            ]);
        }

        if ($action === 'check_in' && ! $setting->allow_check_in) {
            throw ValidationException::withMessages([
                'action' => ['Chi nhánh này không cho phép Check-in trên app nhân viên.'],
            ]);
        }

        if ($action === 'check_out' && ! $setting->allow_check_out) {
            throw ValidationException::withMessages([
                'action' => ['Chi nhánh này không cho phép Check-out trên app nhân viên.'],
            ]);
        }
    }

    protected function assertGeofence(
        Branch $branch,
        ?float $latitude,
        ?float $longitude,
        bool $enforce,
    ): void {
        if (! $enforce) {
            return;
        }

        if ($branch->latitude === null || $branch->longitude === null) {
            return;
        }

        if ($latitude === null || $longitude === null) {
            throw ValidationException::withMessages([
                'latitude' => ['Cần bật định vị GPS để chấm công tại chi nhánh này.'],
            ]);
        }

        $radius = max(20, (int) ($branch->check_in_radius_meters ?: 100));
        $distance = $this->distanceMeters(
            (float) $branch->latitude,
            (float) $branch->longitude,
            $latitude,
            $longitude,
        );

        if ($distance > $radius) {
            $place = trim((string) ($branch->name ?: 'chi nhánh'));
            throw ValidationException::withMessages([
                'latitude' => [
                    'Bạn chưa thật sự có mặt ở cửa hàng '.$place.'.',
                ],
            ]);
        }
    }

    protected function distanceMeters(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earth = 6371000.0;
        $φ1 = deg2rad($lat1);
        $φ2 = deg2rad($lat2);
        $Δφ = deg2rad($lat2 - $lat1);
        $Δλ = deg2rad($lon2 - $lon1);
        $a = sin($Δφ / 2) ** 2 + cos($φ1) * cos($φ2) * sin($Δλ / 2) ** 2;

        return 2 * $earth * asin(min(1.0, sqrt($a)));
    }

    protected function qrWithinHours(AttendanceQrSetting $setting, Carbon $now): bool
    {
        $from = $setting->valid_from ?: '00:00';
        $to = $setting->valid_to ?: '23:59';
        $hm = $now->format('H:i');

        if ($from <= $to) {
            return $hm >= $from && $hm <= $to;
        }

        return $hm >= $from || $hm <= $to;
    }

    public function update(AttendanceLog $log, array $data): AttendanceLog
    {
        AttendancePermission::for()->assertCanManage();
        AttendancePermission::for()->assertCanAccessBranch((int) $log->branch_id);

        return DB::transaction(function () use ($log, $data) {
            $fields = ['check_in_at', 'check_out_at', 'break_minutes', 'location_label', 'note', 'shift_id', 'status'];

            foreach ($fields as $field) {
                if (! array_key_exists($field, $data)) {
                    continue;
                }

                $old = $log->{$field};
                $new = $data[$field];

                if ((string) $old !== (string) $new) {
                    AttendanceAdjustment::query()->create([
                        'organization_id' => $log->organization_id,
                        'attendance_log_id' => $log->id,
                        'adjusted_by' => auth()->id(),
                        'field' => $field,
                        'old_value' => $old instanceof Carbon ? $old->toDateTimeString() : (string) $old,
                        'new_value' => $new instanceof Carbon ? $new->toDateTimeString() : (string) $new,
                        'reason' => $data['reason'] ?? null,
                    ]);
                }
            }

            if (isset($data['check_in_at'])) {
                $log->check_in_at = Carbon::parse($data['check_in_at']);
            }
            if (isset($data['check_out_at'])) {
                $log->check_out_at = $data['check_out_at'] ? Carbon::parse($data['check_out_at']) : null;
            }
            if (array_key_exists('break_minutes', $data)) {
                $log->break_minutes = (int) $data['break_minutes'];
            }
            if (array_key_exists('location_label', $data)) {
                $log->location_label = $data['location_label'];
            }
            if (array_key_exists('note', $data)) {
                $log->note = $data['note'];
            }
            if (array_key_exists('shift_id', $data)) {
                $log->shift_id = $data['shift_id'];
            }

            if ($log->check_in_at && $log->check_out_at) {
                $log->total_minutes = max(0, $log->check_in_at->diffInMinutes($log->check_out_at) - (int) $log->break_minutes);
                $log->status = AttendanceLog::STATUS_CHECKED_OUT;
            } elseif ($log->check_in_at) {
                $log->total_minutes = null;
                $log->status = AttendanceLog::STATUS_WORKING;
            }

            if (isset($data['status'])) {
                $log->status = $data['status'];
            }

            $log->save();

            return $log->fresh(['employee.position', 'shift', 'branch']);
        });
    }

    public function delete(AttendanceLog $log): void
    {
        AttendancePermission::for()->assertCanDelete();
        AttendancePermission::for()->assertCanAccessBranch((int) $log->branch_id);
        $this->excludeRow(
            (int) $log->employee_id,
            $log->work_date?->toDateString() ?? now()->toDateString(),
            (int) $log->branch_id
        );
        $log->delete();
    }

    public function deleteSynthetic(int $employeeId, string $date, int $branchId): void
    {
        $permission = AttendancePermission::for();
        $permission->assertOwnerCanDeleteSynthetic();
        $permission->assertCanAccessBranch($branchId);

        Employee::query()->findOrFail($employeeId);
        Branch::query()->findOrFail($branchId);

        $this->excludeRow($employeeId, $date, $branchId);
    }

    protected function excludeRow(int $employeeId, string $date, int $branchId): void
    {
        if (! Schema::hasTable('attendance_exclusions')) {
            throw ValidationException::withMessages([
                'attendance' => [
                    'Chưa cập nhật cơ sở dữ liệu. Vui lòng chạy php artisan migrate --force.',
                ],
            ]);
        }

        AttendanceExclusion::query()->updateOrCreate(
            [
                'organization_id' => TenantContext::id(),
                'employee_id' => $employeeId,
                'work_date' => $date,
                'branch_id' => $branchId,
            ],
            ['deleted_by' => auth()->id()]
        );
    }

    public function bulk(array $items): array
    {
        AttendancePermission::for()->assertCanManage();
        $success = 0;
        $errors = [];

        foreach ($items as $index => $item) {
            try {
                $action = $item['action'] ?? 'check_in';
                if ($action === 'check_out') {
                    $this->checkOut($item);
                } else {
                    $this->checkIn($item);
                }
                $success++;
            } catch (\Throwable $e) {
                $errors[] = ['index' => $index, 'message' => $e->getMessage()];
            }
        }

        return [
            'success' => true,
            'count' => $success,
            'errors' => $errors,
        ];
    }

    public function adjustments(AttendanceLog $log): Collection
    {
        AttendancePermission::for()->assertCanViewLog($log);

        return $log->adjustments()->with('adjuster')->orderByDesc('id')->get();
    }

    public function export(string $date, ?int $branchId = null): StreamedResponse
    {
        AttendancePermission::for()->assertCanViewAny();
        $rows = $this->roster($date, $branchId);
        $filename = 'attendance-'.$date.'.csv';

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));
            fputcsv($out, [
                'employee_code', 'full_name', 'shift', 'check_in', 'check_out', 'total_minutes', 'status', 'location',
            ]);
            foreach ($rows as $row) {
                fputcsv($out, [
                    $row['employee_code'],
                    $row['full_name'],
                    $row['shift_name'],
                    $row['check_in'],
                    $row['check_out'],
                    $row['total_minutes'],
                    $row['ui_status'],
                    $row['location'],
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function payloadFromRosterRow(array $row): array
    {
        return $row;
    }

    public function payload(AttendanceLog $log): array
    {
        $log->loadMissing(['employee.position', 'shift', 'branch']);
        $shift = $log->shift;

        return $this->buildRowPayload(
            $log->employee,
            $log,
            $shift,
            $log->work_date?->toDateString() ?? now()->toDateString()
        );
    }

    /**
     * @return array{0: Carbon, 1: Carbon}
     */
    protected function parseDateRange(array $filters): array
    {
        $from = $filters['from'] ?? $filters['date'] ?? now()->toDateString();
        $to = $filters['to'] ?? $filters['date'] ?? $from;
        $start = Carbon::parse((string) $from)->startOfDay();
        $end = Carbon::parse((string) $to)->startOfDay();
        if ($end->lt($start)) {
            [$start, $end] = [$end->copy(), $start->copy()];
        }
        if ($start->diffInDays($end) > 31) {
            $end = $start->copy()->addDays(31);
        }

        return [$start, $end];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $rows
     * @return array<string, int>
     */
    protected function statsFromRoster(Collection $rows): array
    {
        $total = $rows->count();
        $checkedIn = $rows->filter(
            fn ($r) => in_array($r['ui_status'], ['working', 'checked_out'], true)
        )->count();
        $working = $rows->filter(fn ($r) => $r['ui_status'] === 'working')->count();
        $notCheckedIn = $rows->filter(fn ($r) => $r['ui_status'] === 'not_checked_in')->count();
        $onLeave = $rows->filter(fn ($r) => $r['ui_status'] === 'on_leave')->count();

        return [
            'total' => $total,
            'checked_in' => $checkedIn,
            'working' => $working,
            'not_checked_in' => $notCheckedIn,
            'checked_out' => max(0, $checkedIn - $working),
            'on_leave' => $onLeave,
        ];
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $roster
     * @return list<array<string, mixed>>
     */
    protected function shiftCardsFromRoster(string $date, Collection $roster): array
    {
        $shifts = Shift::query()
            ->where('status', Shift::STATUS_ACTIVE)
            ->orderBy('start_time')
            ->get();

        return $shifts->map(function (Shift $shift) use ($roster, $date) {
            $rows = $roster->filter(fn ($r) => (int) ($r['shift_id'] ?? 0) === (int) $shift->id);
            $total = max($rows->count(), 0);
            $checked = $rows->filter(
                fn ($r) => in_array($r['ui_status'], ['working', 'checked_out'], true)
            )->count();
            $ontime = $rows->filter(fn ($r) => in_array($r['check_in_tone'], ['early', 'ontime'], true))->count();
            $late = $rows->filter(fn ($r) => $r['check_in_tone'] === 'late')->count();
            $missing = $rows->filter(fn ($r) => $r['ui_status'] === 'not_checked_in')->count();

            $status = 'upcoming';
            if ($shift->isOngoingAt(Carbon::parse($date.' '.now()->format('H:i:s')))) {
                $status = 'ongoing';
            } elseif ($this->shiftEnded($shift)) {
                $status = 'done';
            }

            return [
                'id' => $shift->id,
                'name' => $shift->name,
                'time' => substr((string) $shift->start_time, 0, 5).' - '.substr((string) $shift->end_time, 0, 5),
                'status' => $status,
                'checked' => $checked,
                'total' => $total > 0 ? $total : 0,
                'ontime' => $ontime,
                'late' => $late,
                'missing' => $missing,
            ];
        })->values()->all();
    }

    protected function scopeVisibleLogs(Builder $query, ?int $branchId, Carbon $start, Carbon $end): void
    {
        $permission = AttendancePermission::for();

        if ($branchId) {
            $permission->assertCanAccessBranch($branchId);
            $query->where('branch_id', $branchId);
        }

        if ($permission->isEmployeeOnly()) {
            $query->where('employee_id', $permission->ownEmployee()?->id ?? 0);

            return;
        }

        $query->whereHas('employee', function (Builder $employeeQuery) use ($permission, $branchId, $start, $end) {
            $employeeQuery
                ->where('status', Employee::STATUS_ACTIVE)
                ->where(function (Builder $joined) use ($end) {
                    $joined->whereNull('joined_at')
                        ->orWhereDate('joined_at', '<=', $end->toDateString());
                })
                ->where(function (Builder $resigned) use ($start) {
                    $resigned->whereNull('resigned_at')
                        ->orWhereDate('resigned_at', '>=', $start->toDateString());
                });

            if ($permission->isManager()) {
                $managed = $permission->managedBranchIds();
                $employeeQuery->whereHas('branches', fn (Builder $q) => $q->whereIn('branches.id', $managed));
                if ($branchId) {
                    $employeeQuery->whereHas('branches', fn (Builder $q) => $q->where('branches.id', $branchId));
                }
            } elseif ($branchId) {
                $employeeQuery->whereHas('branches', fn (Builder $q) => $q->where('branches.id', $branchId));
            }
        });

        if ($permission->isManager() && ! $branchId) {
            $managed = $permission->managedBranchIds();
            $query->whereIn('branch_id', $managed->all() ?: [0]);
        }
    }

    protected function scopeUiStatus(Builder $query, string $status): void
    {
        match ($status) {
            'on_leave' => $query->where('status', AttendanceLog::STATUS_LEAVE),
            'absent' => $query->where('status', AttendanceLog::STATUS_ABSENT),
            'checked_out' => $query
                ->whereNotNull('check_out_at')
                ->whereNotIn('status', [AttendanceLog::STATUS_LEAVE, AttendanceLog::STATUS_ABSENT]),
            'working' => $query
                ->whereNotNull('check_in_at')
                ->whereNull('check_out_at')
                ->whereNotIn('status', [AttendanceLog::STATUS_LEAVE, AttendanceLog::STATUS_ABSENT]),
            'not_checked_in' => $query
                ->whereNull('check_in_at')
                ->whereNotIn('status', [AttendanceLog::STATUS_LEAVE, AttendanceLog::STATUS_ABSENT]),
            default => null,
        };
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    protected function roster(string $date, ?int $branchId = null): Collection
    {
        $key = $date.'|'.($branchId ?? 'all');
        if (isset($this->rosterMemo[$key])) {
            return $this->rosterMemo[$key];
        }

        $permission = AttendancePermission::for();

        if ($branchId) {
            $permission->assertCanAccessBranch($branchId);
        }

        $employeeQuery = Employee::query()
            ->with(['position', 'branches'])
            ->where('status', Employee::STATUS_ACTIVE)
            ->where(function ($query) use ($date) {
                $query->whereNull('joined_at')
                    ->orWhereDate('joined_at', '<=', $date);
            })
            ->where(function ($query) use ($date) {
                $query->whereNull('resigned_at')
                    ->orWhereDate('resigned_at', '>=', $date);
            })
            ->orderBy('full_name');

        if ($permission->isEmployeeOnly()) {
            $own = $permission->ownEmployee();
            $employeeQuery->where('id', $own?->id ?? 0);
        } elseif ($permission->isManager()) {
            $managed = $permission->managedBranchIds();
            $employeeQuery->whereHas('branches', fn ($q) => $q->whereIn('branches.id', $managed));
            if ($branchId) {
                $employeeQuery->whereHas('branches', fn ($q) => $q->where('branches.id', $branchId));
            }
        } elseif ($branchId) {
            $employeeQuery->whereHas('branches', fn ($q) => $q->where('branches.id', $branchId));
        }

        $employeeIds = $employeeQuery->pluck('id');
        if ($employeeIds->isEmpty()) {
            return $this->rosterMemo[$key] = collect();
        }

        $logs = AttendanceLog::query()
            ->with(['employee.position', 'employee.branches', 'shift', 'branch'])
            ->whereIn('employee_id', $employeeIds)
            ->whereDate('work_date', $date)
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->orderBy('employee_id')
            ->get();

        return $this->rosterMemo[$key] = $logs->map(function (AttendanceLog $log) use ($date, $branchId) {
            return $this->buildRowPayload(
                $log->employee,
                $log,
                $log->shift,
                $date,
                $branchId
            );
        })->values();
    }

    protected function buildRowPayload(
        Employee $employee,
        ?AttendanceLog $log,
        ?Shift $shift,
        string $date,
        ?int $branchId = null
    ): array {
        $uiStatus = 'not_checked_in';
        $leaveTypeLabel = null;
        if ($log?->status === AttendanceLog::STATUS_LEAVE) {
            $uiStatus = 'on_leave';
            $leaveTypeLabel = LeaveRequest::TYPE_LABELS[$log->leave_type] ?? 'Nghỉ phép';
        } elseif ($log?->status === AttendanceLog::STATUS_ABSENT) {
            $uiStatus = 'absent';
        } elseif ($log?->check_out_at) {
            $uiStatus = 'checked_out';
        } elseif ($log?->check_in_at) {
            $uiStatus = 'working';
        }

        $checkInTone = 'none';
        $checkInLabel = null;
        $checkOutTone = 'none';
        $checkOutLabel = null;

        if ($log?->check_in_at && $shift) {
            [$checkInTone, $checkInLabel] = $this->relativeToShift($log->check_in_at, $shift, 'in');
        }

        if ($log?->check_out_at && $shift) {
            [$checkOutTone, $checkOutLabel] = $this->relativeToShift($log->check_out_at, $shift, 'out');
        } elseif ($uiStatus === 'working') {
            $checkOutTone = 'working';
            $checkOutLabel = 'Đang làm việc';
        } elseif ($uiStatus === 'on_leave') {
            $checkOutLabel = $leaveTypeLabel ?? 'Nghỉ phép';
        } elseif ($uiStatus === 'absent') {
            $checkOutLabel = 'Vắng mặt';
        } elseif ($uiStatus === 'not_checked_in') {
            $checkOutLabel = 'Chưa check-in';
        }

        $totalMinutes = $log?->total_minutes;
        if ($totalMinutes === null && $log?->check_in_at && $log?->check_out_at) {
            $totalMinutes = max(0, $log->check_in_at->diffInMinutes($log->check_out_at) - (int) $log->break_minutes);
        }

        $primaryBranch = $employee->branches->firstWhere('pivot.is_primary', true)
            ?? $employee->branches->first();
        $resolvedBranchId = $log?->branch_id ?? $branchId ?? $primaryBranch?->id;
        $branchName = $log?->branch?->name
            ?? $employee->branches->firstWhere('id', $resolvedBranchId)?->name
            ?? $primaryBranch?->name
            ?? '—';

        return [
            'id' => $log?->id,
            'employee_id' => $employee->id,
            'employee_code' => $employee->employee_code,
            'full_name' => $employee->full_name,
            'avatar' => $employee->resolvedAvatarUrl(),
            'position' => $employee->position?->name ?? '—',
            'branch_id' => $resolvedBranchId,
            'branch_name' => $branchName,
            'shift_id' => $shift?->id,
            'shift_name' => $shift?->name ?? '—',
            'shift_time' => $shift
                ? substr((string) $shift->start_time, 0, 5).' - '.substr((string) $shift->end_time, 0, 5)
                : '—',
            'check_in' => $log?->check_in_at?->format('H:i'),
            'check_in_label' => $checkInLabel,
            'check_in_tone' => $checkInTone,
            'check_out' => $log?->check_out_at?->format('H:i'),
            'check_out_label' => $checkOutLabel,
            'check_out_tone' => $checkOutTone,
            'total_minutes' => $totalMinutes,
            'total_hours' => $totalMinutes !== null ? $this->formatDuration((int) $totalMinutes) : '—',
            'status' => $log?->status,
            'ui_status' => $uiStatus,
            'leave_type' => $log?->leave_type,
            'leave_type_label' => $leaveTypeLabel,
            'leave_request_id' => $log?->leave_request_id,
            'location' => $log?->location_label,
            'work_date' => $date,
            'note' => $log?->note,
            'break_minutes' => $log?->break_minutes,
        ];
    }

    /**
     * @return array{0: string, 1: string}
     */
    protected function relativeToShift(Carbon $at, Shift $shift, string $type): array
    {
        $base = $type === 'in'
            ? Carbon::parse($at->toDateString().' '.substr((string) $shift->start_time, 0, 8))
            : Carbon::parse($at->toDateString().' '.substr((string) $shift->end_time, 0, 8));

        if ($type === 'out' && $shift->crossesMidnight() && $at->format('H:i') < substr((string) $shift->end_time, 0, 5)) {
            // end next day already on $at date typically
        }

        $diff = $base->diffInMinutes($at, false);

        if (abs($diff) <= 2) {
            return ['ontime', 'Đúng giờ'];
        }

        if ($diff < 0) {
            return ['early', 'Sớm '.abs($diff).' phút'];
        }

        return ['late', 'Trễ '.$diff.' phút'];
    }

    protected function formatDuration(int $minutes): string
    {
        $h = intdiv($minutes, 60);
        $m = $minutes % 60;

        return $h.'h '.str_pad((string) $m, 2, '0', STR_PAD_LEFT).'m';
    }

    protected function shiftEnded(Shift $shift): bool
    {
        if ($shift->isOngoingAt()) {
            return false;
        }

        $now = ((int) now()->format('H')) * 60 + (int) now()->format('i');
        $end = ((int) substr((string) $shift->end_time, 0, 2)) * 60 + (int) substr((string) $shift->end_time, 3, 2);
        $start = ((int) substr((string) $shift->start_time, 0, 2)) * 60 + (int) substr((string) $shift->start_time, 3, 2);

        if ($end <= $start) {
            return $now >= $end && $now < $start;
        }

        return $now >= $end;
    }

    protected function assertNotOnLeave(int $employeeId, string $date): void
    {
        $onLeave = AttendanceLog::query()
            ->where('employee_id', $employeeId)
            ->whereDate('work_date', $date)
            ->where('status', AttendanceLog::STATUS_LEAVE)
            ->exists();

        if ($onLeave) {
            throw ValidationException::withMessages([
                'employee_id' => ['Nhân viên đang nghỉ phép ngày này.'],
            ]);
        }

        $approved = LeaveRequest::query()
            ->where('employee_id', $employeeId)
            ->where('status', LeaveRequest::STATUS_APPROVED)
            ->whereDate('starts_on', '<=', $date)
            ->whereDate('ends_on', '>=', $date)
            ->exists();

        if ($approved) {
            throw ValidationException::withMessages([
                'employee_id' => ['Nhân viên đang nghỉ phép ngày này.'],
            ]);
        }
    }
}
