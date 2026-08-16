<?php

namespace App\Services\Attendance;

use App\Models\AttendanceLog;
use App\Models\AttendanceQrSetting;
use App\Models\Branch;
use App\Models\Employee;
use App\Support\Authorization\AttendancePermission;
use App\Support\Tenancy\TenantContext;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AttendanceQrService
{
    public const ROTATE_OPTIONS = [5, 10, 15, 30, 45, 60, 120];

    public function settings(?int $branchId = null): array
    {
        AttendancePermission::for()->assertCanViewAny();

        $branch = $this->resolveBranch($branchId);
        $setting = $this->findOrCreate($branch);

        return $this->settingsPayload($setting, $branch);
    }

    public function update(array $data): array
    {
        AttendancePermission::for()->assertCanManage();

        $branch = $this->resolveBranch((int) $data['branch_id']);
        $setting = $this->findOrCreate($branch);

        $rotate = (int) ($data['rotate_seconds'] ?? $setting->rotate_seconds);
        if (! in_array($rotate, self::ROTATE_OPTIONS, true)) {
            throw ValidationException::withMessages([
                'rotate_seconds' => ['Thời gian đổi QR không hợp lệ.'],
            ]);
        }

        $setting->fill([
            'enabled' => (bool) ($data['enabled'] ?? $setting->enabled),
            'rotate_seconds' => $rotate,
            'valid_from' => $data['valid_from'] ?? $setting->valid_from,
            'valid_to' => $data['valid_to'] ?? $setting->valid_to,
            'allow_check_in' => (bool) ($data['allow_check_in'] ?? $setting->allow_check_in),
            'allow_check_out' => (bool) ($data['allow_check_out'] ?? $setting->allow_check_out),
        ])->save();

        return $this->settingsPayload($setting->fresh(), $branch);
    }

    public function current(?int $branchId = null): array
    {
        AttendancePermission::for()->assertCanViewAny();

        $branch = $this->resolveBranch($branchId);
        $setting = $this->findOrCreate($branch);

        if (! $setting->enabled) {
            throw ValidationException::withMessages([
                'enabled' => ['QR chấm công đang tắt tại chi nhánh này.'],
            ]);
        }

        $now = now('Asia/Ho_Chi_Minh');
        $rotate = max(5, (int) $setting->rotate_seconds);
        $slot = intdiv($now->timestamp, $rotate);
        $expiresAt = ($slot + 1) * $rotate;
        $secondsLeft = max(1, $expiresAt - $now->timestamp);

        $token = $this->makeToken(
            (int) TenantContext::id(),
            (int) $branch->id,
            $slot,
        );

        $payload = [
            'v' => 1,
            'org_id' => (int) TenantContext::id(),
            'branch_id' => (int) $branch->id,
            'slot' => $slot,
            'token' => $token,
            'type' => 'attendance_qr',
        ];

        return [
            'enabled' => true,
            'branch' => [
                'id' => $branch->id,
                'name' => $branch->name,
            ],
            'rotate_seconds' => $rotate,
            'expires_in' => $secondsLeft,
            'expires_at' => Carbon::createFromTimestamp($expiresAt, 'Asia/Ho_Chi_Minh')->toIso8601String(),
            'updated_at' => $now->format('H:i:s').' • '.$now->format('d/m/Y'),
            'payload' => $payload,
            'qr_value' => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'allow_check_in' => $setting->allow_check_in,
            'allow_check_out' => $setting->allow_check_out,
            'valid_from' => $setting->valid_from,
            'valid_to' => $setting->valid_to,
            'within_hours' => $this->withinHours($setting, $now),
        ];
    }

    public function recent(?int $branchId = null, int $limit = 8): array
    {
        AttendancePermission::for()->assertCanViewAny();

        $branch = $this->resolveBranch($branchId);
        $limit = max(1, min(50, $limit));

        $logs = AttendanceLog::query()
            ->with(['employee.position', 'shift'])
            ->where('branch_id', $branch->id)
            ->where(function ($q) {
                $q->whereNotNull('check_in_at')->orWhereNotNull('check_out_at');
            })
            ->orderByDesc(DB::raw('COALESCE(check_out_at, check_in_at)'))
            ->limit($limit * 2)
            ->get();

        $rows = [];
        foreach ($logs as $log) {
            if ($log->check_out_at && count($rows) < $limit) {
                $rows[] = $this->historyRow($log, 'check_out', $log->check_out_at);
            }
            if ($log->check_in_at && count($rows) < $limit) {
                $rows[] = $this->historyRow($log, 'check_in', $log->check_in_at);
            }
            if (count($rows) >= $limit) {
                break;
            }
        }

        usort($rows, fn ($a, $b) => strcmp($b['at_raw'], $a['at_raw']));

        return array_slice($rows, 0, $limit);
    }

    public function scan(array $data): array
    {
        $permission = AttendancePermission::for();
        $employee = Employee::query()->findOrFail((int) $data['employee_id']);
        $branchId = (int) $data['branch_id'];
        $permission->assertCanCheckFor($employee, $branchId);

        $branch = Branch::query()->findOrFail($branchId);
        $setting = $this->findOrCreate($branch);

        if (! $setting->enabled) {
            throw ValidationException::withMessages([
                'token' => ['QR chấm công đang tắt.'],
            ]);
        }

        $now = now('Asia/Ho_Chi_Minh');
        if (! $this->withinHours($setting, $now)) {
            throw ValidationException::withMessages([
                'token' => ['Ngoài khung giờ hiệu lực của QR.'],
            ]);
        }

        $slot = (int) ($data['slot'] ?? -1);
        $token = (string) ($data['token'] ?? '');
        $expected = $this->makeToken((int) TenantContext::id(), $branchId, $slot);
        $prevExpected = $this->makeToken((int) TenantContext::id(), $branchId, $slot - 1);

        if (! hash_equals($expected, $token) && ! hash_equals($prevExpected, $token)) {
            throw ValidationException::withMessages([
                'token' => ['Mã QR không hợp lệ hoặc đã hết hạn.'],
            ]);
        }

        $action = $data['action'] ?? 'auto';
        $attendance = app(AttendanceService::class);

        if ($action === 'auto') {
            $existing = AttendanceLog::query()
                ->where('employee_id', $employee->id)
                ->where('branch_id', $branchId)
                ->whereDate('work_date', $now->toDateString())
                ->first();

            if ($existing && $existing->check_in_at && ! $existing->check_out_at) {
                $action = 'check_out';
            } else {
                $action = 'check_in';
            }
        }

        if ($action === 'check_in' && ! $setting->allow_check_in) {
            throw ValidationException::withMessages([
                'action' => ['Chi nhánh này không cho phép Check-in qua QR.'],
            ]);
        }
        if ($action === 'check_out' && ! $setting->allow_check_out) {
            throw ValidationException::withMessages([
                'action' => ['Chi nhánh này không cho phép Check-out qua QR.'],
            ]);
        }

        $payload = [
            'employee_id' => $employee->id,
            'branch_id' => $branchId,
            'work_date' => $now->toDateString(),
            'location_label' => 'QR · '.$branch->name,
            'device' => $data['device'] ?? request()->userAgent(),
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
        ];

        $log = $action === 'check_out'
            ? $attendance->checkOut($payload)
            : $attendance->checkIn($payload);

        return [
            'action' => $action,
            'data' => $attendance->payload($log),
        ];
    }

    protected function findOrCreate(Branch $branch): AttendanceQrSetting
    {
        return AttendanceQrSetting::query()->firstOrCreate(
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
    }

    protected function resolveBranch(?int $branchId): Branch
    {
        $permission = AttendancePermission::for();

        if ($branchId) {
            $permission->assertCanAccessBranch($branchId);

            return Branch::query()->findOrFail($branchId);
        }

        $query = Branch::query()->where('is_active', true)->orderByDesc('is_headquarters')->orderBy('name');

        if ($permission->isManager()) {
            $managed = $permission->managedBranchIds();
            $query->whereIn('id', $managed);
        }

        $branch = $query->first();

        if (! $branch) {
            throw ValidationException::withMessages([
                'branch_id' => ['Chưa có chi nhánh để tạo QR chấm công.'],
            ]);
        }

        $permission->assertCanAccessBranch((int) $branch->id);

        return $branch;
    }

    protected function settingsPayload(AttendanceQrSetting $setting, Branch $branch): array
    {
        return [
            'id' => $setting->id,
            'enabled' => $setting->enabled,
            'rotate_seconds' => $setting->rotate_seconds,
            'valid_from' => $setting->valid_from,
            'valid_to' => $setting->valid_to,
            'allow_check_in' => $setting->allow_check_in,
            'allow_check_out' => $setting->allow_check_out,
            'branch' => [
                'id' => $branch->id,
                'name' => $branch->name,
                'address' => $branch->address,
            ],
            'branch_id' => $branch->id,
            'rotate_options' => self::ROTATE_OPTIONS,
        ];
    }

    protected function makeToken(int $orgId, int $branchId, int $slot): string
    {
        $raw = $orgId.'|'.$branchId.'|'.$slot;

        return hash_hmac('sha256', $raw, (string) config('app.key'));
    }

    protected function withinHours(AttendanceQrSetting $setting, Carbon $now): bool
    {
        $from = $setting->valid_from ?: '00:00';
        $to = $setting->valid_to ?: '23:59';
        $current = $now->format('H:i');

        if ($from <= $to) {
            return $current >= $from && $current <= $to;
        }

        return $current >= $from || $current <= $to;
    }

    protected function historyRow(AttendanceLog $log, string $action, Carbon $at): array
    {
        $shift = $log->shift;
        $shiftLabel = $shift
            ? $shift->name.' ('.substr((string) $shift->start_time, 0, 5).' - '.substr((string) $shift->end_time, 0, 5).')'
            : '—';

        return [
            'id' => $log->id.'-'.$action,
            'employee_id' => $log->employee_id,
            'full_name' => $log->employee?->full_name ?? '—',
            'avatar' => $log->employee?->resolvedAvatarUrl(),
            'position' => $log->employee?->position?->name,
            'shift_label' => $shiftLabel,
            'action' => $action,
            'action_label' => $action === 'check_in' ? 'Check-in' : 'Check-out',
            'time' => $at->timezone('Asia/Ho_Chi_Minh')->format('H:i:s'),
            'ok' => true,
            'at_raw' => $at->toIso8601String(),
        ];
    }
}
