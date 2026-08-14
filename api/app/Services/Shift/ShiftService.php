<?php

namespace App\Services\Shift;

use App\Models\Branch;
use App\Models\Organization;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Support\Authorization\ShiftPermission;
use App\Support\Tenancy\TenantContext;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ShiftService
{
    public const DEFAULTS = [
        ['name' => 'Ca sáng', 'code' => 'CS', 'start' => '08:00', 'end' => '16:00', 'break' => 60, 'color' => '#3BB2F6', 'icon' => 'sun'],
        ['name' => 'Ca chiều', 'code' => 'CC', 'start' => '14:00', 'end' => '22:00', 'break' => 60, 'color' => '#F59E0B', 'icon' => 'sunset'],
        ['name' => 'Ca tối', 'code' => 'CT', 'start' => '17:00', 'end' => '23:00', 'break' => 30, 'color' => '#8B5CF6', 'icon' => 'moon'],
        ['name' => 'Ca đêm', 'code' => 'CD', 'start' => '22:00', 'end' => '06:00', 'break' => 45, 'color' => '#64748B', 'icon' => 'night'],
    ];

    public function seedDefaults(?Organization $organization = null): void
    {
        $organization ??= TenantContext::organization();

        if (! $organization) {
            return;
        }

        foreach (self::DEFAULTS as $row) {
            Shift::query()->firstOrCreate(
                [
                    'organization_id' => $organization->id,
                    'code' => $row['code'],
                ],
                [
                    'name' => $row['name'],
                    'start_time' => $row['start'],
                    'end_time' => $row['end'],
                    'break_minutes' => $row['break'],
                    'color' => $row['color'],
                    'icon' => $row['icon'],
                    'description' => $row['name'].' mặc định',
                    'status' => Shift::STATUS_ACTIVE,
                ]
            );
        }
    }

    public function list(array $filters = []): LengthAwarePaginator
    {
        ShiftPermission::for()->assertCanViewAny();

        $this->seedDefaults();

        $query = Shift::query()->orderBy('start_time')->orderBy('name');

        $permission = ShiftPermission::for();
        if ($permission->isManager()) {
            $branchIds = $permission->managedBranchIds();
            $query->where(function ($q) use ($branchIds) {
                $q->whereNull('branch_id')
                    ->orWhereIn('branch_id', $branchIds);
            });
        }

        if (! empty($filters['branch_id'])) {
            $branchId = (int) $filters['branch_id'];
            $query->where(function ($q) use ($branchId) {
                $q->whereNull('branch_id')->orWhere('branch_id', $branchId);
            });
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['search'])) {
            $like = '%'.mb_strtolower(trim((string) $filters['search'])).'%';
            $query->where(function ($q) use ($like) {
                $q->whereRaw('lower(name) like ?', [$like])
                    ->orWhereRaw('lower(code) like ?', [$like]);
            });
        }

        return $query->paginate((int) ($filters['per_page'] ?? 20));
    }

    public function findOrFail(int $id): Shift
    {
        ShiftPermission::for()->assertCanViewAny();

        $shift = Shift::query()->findOrFail($id);
        $permission = ShiftPermission::for();

        if ($permission->isManager() && ! $permission->canManageShift($shift) && $shift->branch_id !== null) {
            abort(403, 'Bạn không có quyền xem ca làm này.');
        }

        return $shift;
    }

    public function create(array $data): Shift
    {
        $permission = ShiftPermission::for();
        $permission->assertCanManage();

        $branchId = isset($data['branch_id']) ? (int) $data['branch_id'] : null;
        if ($permission->isManager()) {
            if ($branchId === null) {
                $branchId = (int) $permission->managedBranchIds()->first();
            }
            $permission->assertCanAccessBranch($branchId);
        }

        if ($branchId) {
            Branch::query()->findOrFail($branchId);
        }

        $break = (int) ($data['break_time'] ?? $data['break_minutes'] ?? 0);
        $code = strtoupper(trim((string) ($data['code'] ?? $this->suggestCode($data['name']))));

        return Shift::query()->create([
            'organization_id' => TenantContext::id(),
            'branch_id' => $branchId,
            'name' => trim($data['name']),
            'code' => $code,
            'start_time' => $data['start_time'],
            'end_time' => $data['end_time'],
            'break_minutes' => $break,
            'color' => $data['color'] ?? '#3BB2F6',
            'icon' => $data['icon'] ?? null,
            'description' => $data['description'] ?? null,
            'capacity' => $data['capacity'] ?? null,
            'status' => $data['status'] ?? Shift::STATUS_ACTIVE,
        ]);
    }

    public function update(Shift $shift, array $data): Shift
    {
        ShiftPermission::for()->assertCanManageShift($shift);

        if (array_key_exists('branch_id', $data) && $data['branch_id']) {
            Branch::query()->findOrFail((int) $data['branch_id']);
            ShiftPermission::for()->assertCanAccessBranch((int) $data['branch_id']);
        }

        $payload = collect($data)->only([
            'name',
            'code',
            'start_time',
            'end_time',
            'color',
            'icon',
            'description',
            'capacity',
            'status',
            'branch_id',
        ])->all();

        if (isset($data['break_time']) || isset($data['break_minutes'])) {
            $payload['break_minutes'] = (int) ($data['break_time'] ?? $data['break_minutes']);
        }

        if (isset($payload['code'])) {
            $payload['code'] = strtoupper(trim((string) $payload['code']));
        }

        $shift->fill($payload);
        $shift->save();

        return $shift->fresh();
    }

    public function delete(Shift $shift): void
    {
        ShiftPermission::for()->assertCanDelete();
        ShiftPermission::for()->assertCanManageShift($shift);

        if ($shift->assignments()->where('status', ShiftAssignment::STATUS_ASSIGNED)->exists()) {
            throw ValidationException::withMessages([
                'shift' => ['Không thể xoá ca đang có phân công. Hãy ngừng hoạt động hoặc huỷ phân công trước.'],
            ]);
        }

        $shift->delete();
    }

    public function summary(?int $branchId = null): array
    {
        ShiftPermission::for()->assertCanViewAny();

        $today = now()->toDateString();
        $shiftsQuery = Shift::query();

        $permission = ShiftPermission::for();
        if ($permission->isManager()) {
            $managed = $permission->managedBranchIds();
            $shiftsQuery->where(function ($q) use ($managed) {
                $q->whereNull('branch_id')->orWhereIn('branch_id', $managed);
            });
            if ($branchId && ! $managed->contains($branchId)) {
                $branchId = null;
            }
        }

        if ($branchId) {
            $shiftsQuery->where(function ($q) use ($branchId) {
                $q->whereNull('branch_id')->orWhere('branch_id', $branchId);
            });
        }

        $shifts = $shiftsQuery->get();
        $total = $shifts->count();
        $active = $shifts->where('status', Shift::STATUS_ACTIVE)->count();
        $ongoing = $shifts->filter(fn (Shift $s) => $s->isOngoingAt())->count();

        $assignQuery = ShiftAssignment::query()
            ->whereDate('date', $today)
            ->where('status', ShiftAssignment::STATUS_ASSIGNED);

        if ($branchId) {
            $assignQuery->where('branch_id', $branchId);
        } elseif ($permission->isManager()) {
            $assignQuery->whereIn('branch_id', $permission->managedBranchIds());
        }

        $employeesToday = (clone $assignQuery)->distinct('employee_id')->count('employee_id');

        $assignedByShift = (clone $assignQuery)
            ->selectRaw('shift_id, count(distinct employee_id) as cnt')
            ->groupBy('shift_id')
            ->pluck('cnt', 'shift_id');

        $openSlots = 0;
        foreach ($shifts->where('status', Shift::STATUS_ACTIVE) as $shift) {
            $count = (int) ($assignedByShift[$shift->id] ?? 0);
            if ($shift->capacity !== null && $shift->capacity > 0) {
                $openSlots += max(0, $shift->capacity - $count);
            } elseif ($count === 0) {
                $openSlots += 1;
            }
        }

        return [
            'total' => $total,
            'active' => $active,
            'active_percent' => $total > 0 ? round(($active / $total) * 100, 1) : 0,
            'employees_today' => $employeesToday,
            'ongoing_shifts' => $ongoing,
            'open_slots' => $openSlots,
        ];
    }

    public function payload(Shift $shift, ?string $forDate = null): array
    {
        $forDate ??= now()->toDateString();

        $employeeCount = ShiftAssignment::query()
            ->where('shift_id', $shift->id)
            ->whereDate('date', $forDate)
            ->where('status', ShiftAssignment::STATUS_ASSIGNED)
            ->distinct('employee_id')
            ->count('employee_id');

        $start = substr((string) $shift->start_time, 0, 5);
        $end = substr((string) $shift->end_time, 0, 5);
        $duration = $shift->durationMinutes();

        return [
            'id' => $shift->id,
            'branch_id' => $shift->branch_id,
            'name' => $shift->name,
            'code' => $shift->code,
            'start_time' => $start,
            'end_time' => $end,
            'crosses_midnight' => $shift->crossesMidnight(),
            'duration_minutes' => $duration,
            'break_minutes' => $shift->break_minutes,
            'break_time' => $shift->break_minutes,
            'total_minutes' => $duration + $shift->break_minutes,
            'color' => $shift->color,
            'icon' => $shift->icon,
            'description' => $shift->description,
            'capacity' => $shift->capacity,
            'status' => $shift->status,
            'employee_count' => $employeeCount,
            'is_ongoing' => $shift->isOngoingAt(),
        ];
    }

    public function import(UploadedFile $file, ?int $branchId = null): array
    {
        ShiftPermission::for()->assertCanManage();
        if ($branchId) {
            ShiftPermission::for()->assertCanAccessBranch($branchId);
            Branch::query()->findOrFail($branchId);
        }

        $handle = fopen($file->getRealPath(), 'r');
        if ($handle === false) {
            throw ValidationException::withMessages([
                'file' => ['Không đọc được file.'],
            ]);
        }

        $header = null;
        $count = 0;
        $errors = [];

        while (($row = fgetcsv($handle)) !== false) {
            if ($header === null) {
                $header = array_map(fn ($h) => mb_strtolower(trim((string) $h)), $row);
                continue;
            }

            if (count(array_filter($row, fn ($v) => trim((string) $v) !== '')) === 0) {
                continue;
            }

            $data = [];
            foreach ($header as $i => $key) {
                $data[$key] = $row[$i] ?? null;
            }

            try {
                $this->create([
                    'name' => $data['name'] ?? null,
                    'code' => $data['code'] ?? null,
                    'start_time' => $data['start_time'] ?? null,
                    'end_time' => $data['end_time'] ?? null,
                    'break_time' => (int) ($data['break_time'] ?? $data['break_minutes'] ?? 0),
                    'color' => $data['color'] ?? '#3BB2F6',
                    'description' => $data['description'] ?? null,
                    'status' => $data['status'] ?? Shift::STATUS_ACTIVE,
                    'branch_id' => $branchId,
                ]);
                $count++;
            } catch (\Throwable $e) {
                $errors[] = $e->getMessage();
            }
        }

        fclose($handle);

        return [
            'success' => true,
            'count' => $count,
            'errors' => $errors,
        ];
    }

    public function export(?int $branchId = null): StreamedResponse
    {
        ShiftPermission::for()->assertCanViewAny();

        $paginator = $this->list([
            'branch_id' => $branchId,
            'per_page' => 1000,
        ]);

        $filename = 'shifts-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($paginator) {
            $out = fopen('php://output', 'w');
            fprintf($out, chr(0xEF).chr(0xBB).chr(0xBF));
            fputcsv($out, [
                'name', 'code', 'start_time', 'end_time', 'break_time', 'color', 'description', 'status',
            ]);
            foreach ($paginator->items() as $shift) {
                /** @var Shift $shift */
                fputcsv($out, [
                    $shift->name,
                    $shift->code,
                    substr((string) $shift->start_time, 0, 5),
                    substr((string) $shift->end_time, 0, 5),
                    $shift->break_minutes,
                    $shift->color,
                    $shift->description,
                    $shift->status,
                ]);
            }
            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    protected function suggestCode(string $name): string
    {
        $base = strtoupper(Str::of($name)->ascii()->substr(0, 8)->replaceMatches('/[^A-Z0-9]/', '')->toString());
        if ($base === '') {
            $base = 'CA';
        }

        $code = $base;
        $i = 1;
        while (Shift::query()->where('code', $code)->exists()) {
            $code = $base.$i;
            $i++;
        }

        return $code;
    }
}
