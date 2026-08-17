<?php

namespace App\Services\Shift;

use App\Models\Branch;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Support\Authorization\ShiftPermission;
use App\Support\Tenancy\TenantContext;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ShiftAssignmentService
{
    public function list(array $filters = []): Collection
    {
        ShiftPermission::for()->assertCanViewAny();

        $query = ShiftAssignment::query()
            ->with(['employee', 'shift', 'branch'])
            ->orderBy('date')
            ->orderBy('id');

        $permission = ShiftPermission::for();
        if ($permission->isManager()) {
            $query->whereIn('branch_id', $permission->managedBranchIds());
        }

        if (! empty($filters['branch_id'])) {
            $query->where('branch_id', (int) $filters['branch_id']);
        }

        if (! empty($filters['shift_id'])) {
            $query->where('shift_id', (int) $filters['shift_id']);
        }

        if (! empty($filters['employee_id'])) {
            $query->where('employee_id', (int) $filters['employee_id']);
        }

        if (! empty($filters['date_from'])) {
            $query->whereDate('date', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('date', '<=', $filters['date_to']);
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        } else {
            $query->where('status', '!=', ShiftAssignment::STATUS_CANCELLED);
        }

        return $query->get();
    }

    public function assign(array $data): ShiftAssignment
    {
        $permission = ShiftPermission::for();
        $permission->assertCanManage();

        $branchId = (int) $data['branch_id'];
        $permission->assertCanAccessBranch($branchId);

        $branch = Branch::query()->findOrFail($branchId);
        $shift = Shift::query()->findOrFail((int) $data['shift_id']);
        $employee = Employee::query()->findOrFail((int) $data['employee_id']);
        $date = Carbon::parse((string) $data['date'], config('app.timezone'))
            ->startOfDay();

        $this->assertNotInPast($date);
        $this->assertNotOnApprovedLeave((int) $employee->id, $date);

        if ($shift->status !== Shift::STATUS_ACTIVE) {
            throw ValidationException::withMessages([
                'shift_id' => ['Ca làm không còn hoạt động.'],
            ]);
        }

        if ($employee->status === Employee::STATUS_RESIGNED) {
            throw ValidationException::withMessages([
                'employee_id' => ['Nhân viên đã nghỉ việc.'],
            ]);
        }

        $belongs = $employee->branches()->where('branches.id', $branchId)->exists();
        if (! $belongs) {
            throw ValidationException::withMessages([
                'employee_id' => ['Nhân viên chưa được gán vào chi nhánh này.'],
            ]);
        }

        return DB::transaction(function () use ($data, $employee, $shift, $branch, $date) {
            ShiftAssignment::query()
                ->where('employee_id', $employee->id)
                ->where('branch_id', $branch->id)
                ->whereDate('date', $date->toDateString())
                ->where('status', ShiftAssignment::STATUS_ASSIGNED)
                ->where('shift_id', '!=', $shift->id)
                ->update(['status' => ShiftAssignment::STATUS_CANCELLED]);

            $existing = ShiftAssignment::query()
                ->where('employee_id', $employee->id)
                ->where('shift_id', $shift->id)
                ->where('branch_id', $branch->id)
                ->whereDate('date', $date->toDateString())
                ->lockForUpdate()
                ->first();

            if ($existing) {
                $existing->forceFill([
                    'status' => ShiftAssignment::STATUS_ASSIGNED,
                    'note' => array_key_exists('note', $data) ? ($data['note'] ?? null) : $existing->note,
                ])->save();

                return $existing->fresh(['employee', 'shift', 'branch']);
            }

            return ShiftAssignment::query()->create([
                'organization_id' => TenantContext::id(),
                'employee_id' => $employee->id,
                'shift_id' => $shift->id,
                'branch_id' => $branch->id,
                'date' => $date->toDateString(),
                'status' => ShiftAssignment::STATUS_ASSIGNED,
                'note' => $data['note'] ?? null,
            ])->load(['employee', 'shift', 'branch']);
        });
    }

    /**
     * @return array{created: int, skipped: int}
     */
    public function bulkAssign(array $data): array
    {
        $permission = ShiftPermission::for();
        $permission->assertCanManage();

        $branchId = (int) $data['branch_id'];
        $permission->assertCanAccessBranch($branchId);

        $employeeIds = collect($data['employee_ids'] ?? [])
            ->map(fn ($id) => (int) $id)
            ->filter()
            ->unique()
            ->values()
            ->all();

        if ($employeeIds === []) {
            throw ValidationException::withMessages([
                'employee_ids' => ['Chọn ít nhất một nhân viên.'],
            ]);
        }

        $from = Carbon::parse((string) $data['date_from'], config('app.timezone'))->startOfDay();
        $to = Carbon::parse((string) $data['date_to'], config('app.timezone'))->startOfDay();
        if ($to->diffInDays($from) > 62) {
            throw ValidationException::withMessages([
                'date_to' => ['Khoảng ngày tối đa 62 ngày.'],
            ]);
        }

        /** @var list<int>|null $weekdays */
        $weekdays = isset($data['weekdays']) && is_array($data['weekdays'])
            ? array_values(array_unique(array_map('intval', $data['weekdays'])))
            : null;

        $created = 0;
        $skipped = 0;

        DB::transaction(function () use ($data, $employeeIds, $from, $to, $weekdays, &$created, &$skipped) {
            for ($date = $from->copy(); $date->lte($to); $date->addDay()) {
                if ($weekdays !== null && ! in_array($date->dayOfWeekIso, $weekdays, true)) {
                    continue;
                }

                foreach ($employeeIds as $employeeId) {
                    if ($this->tryAssign([
                        'employee_id' => $employeeId,
                        'shift_id' => (int) $data['shift_id'],
                        'branch_id' => (int) $data['branch_id'],
                        'date' => $date->toDateString(),
                        'note' => $data['note'] ?? null,
                    ])) {
                        $created++;
                    } else {
                        $skipped++;
                    }
                }
            }
        });

        return ['created' => $created, 'skipped' => $skipped];
    }

    /**
     * @return array{created: int, skipped: int}
     */
    public function copyWeek(array $data): array
    {
        $permission = ShiftPermission::for();
        $permission->assertCanManage();

        $sourceFrom = Carbon::parse((string) $data['source_from'], config('app.timezone'))->startOfDay();
        $sourceTo = Carbon::parse((string) $data['source_to'], config('app.timezone'))->startOfDay();
        $targetFrom = Carbon::parse((string) $data['target_from'], config('app.timezone'))->startOfDay();

        if ($sourceTo->lt($sourceFrom) || $sourceFrom->diffInDays($sourceTo) > 6) {
            throw ValidationException::withMessages([
                'source_to' => ['Chọn tối đa 7 ngày nguồn (một tuần).'],
            ]);
        }

        $this->assertNotInPast($targetFrom);

        $offsetDays = (int) round($sourceFrom->diffInDays($targetFrom, false));
        $branchFilter = ! empty($data['branch_id']) ? (int) $data['branch_id'] : null;
        if ($branchFilter) {
            $permission->assertCanAccessBranch($branchFilter);
        }

        $query = ShiftAssignment::query()
            ->with(['employee', 'shift', 'branch'])
            ->where('status', ShiftAssignment::STATUS_ASSIGNED)
            ->whereDate('date', '>=', $sourceFrom->toDateString())
            ->whereDate('date', '<=', $sourceTo->toDateString());

        if ($branchFilter) {
            $query->where('branch_id', $branchFilter);
        }

        if ($permission->isManager()) {
            $query->whereIn('branch_id', $permission->managedBranchIds());
        }

        $sourceRows = $query->get();

        $created = 0;
        $skipped = 0;

        DB::transaction(function () use ($sourceRows, $offsetDays, &$created, &$skipped) {
            foreach ($sourceRows as $row) {
                $sourceDate = Carbon::parse($row->date?->toDateString() ?? $row->date, config('app.timezone'))
                    ->startOfDay();
                $targetDate = $sourceDate->copy()->addDays($offsetDays);

                if ($this->tryAssign([
                    'employee_id' => (int) $row->employee_id,
                    'shift_id' => (int) $row->shift_id,
                    'branch_id' => (int) $row->branch_id,
                    'date' => $targetDate->toDateString(),
                    'note' => $row->note,
                ])) {
                    $created++;
                } else {
                    $skipped++;
                }
            }
        });

        return ['created' => $created, 'skipped' => $skipped];
    }

    /**
     * @param  array{employee_id: int, shift_id: int, branch_id: int, date: string, note?: string|null}  $data
     */
    protected function tryAssign(array $data): bool
    {
        try {
            $this->assign($data);

            return true;
        } catch (ValidationException|ModelNotFoundException|QueryException) {
            return false;
        }
    }

    public function unassign(ShiftAssignment $assignment): void
    {
        $permission = ShiftPermission::for();
        $permission->assertCanManage();
        $permission->assertCanAccessBranch((int) $assignment->branch_id);

        $assignment->forceFill([
            'status' => ShiftAssignment::STATUS_CANCELLED,
        ])->save();
    }

    public function findOrFail(int $id): ShiftAssignment
    {
        ShiftPermission::for()->assertCanViewAny();

        $assignment = ShiftAssignment::query()
            ->with(['employee', 'shift', 'branch'])
            ->findOrFail($id);

        $permission = ShiftPermission::for();
        if ($permission->isManager() && ! $permission->canAccessBranch((int) $assignment->branch_id)) {
            abort(403, 'Bạn không có quyền xem phân ca này.');
        }

        return $assignment;
    }

    public function payload(ShiftAssignment $assignment): array
    {
        $assignment->loadMissing(['employee', 'shift', 'branch']);

        return [
            'id' => $assignment->id,
            'date' => $assignment->date?->toDateString(),
            'status' => $assignment->status,
            'note' => $assignment->note,
            'employee' => $assignment->employee ? [
                'id' => $assignment->employee->id,
                'employee_code' => $assignment->employee->employee_code,
                'full_name' => $assignment->employee->full_name,
                'avatar' => $assignment->employee->resolvedAvatarUrl(),
            ] : null,
            'shift' => $assignment->shift ? [
                'id' => $assignment->shift->id,
                'name' => $assignment->shift->name,
                'code' => $assignment->shift->code,
                'start_time' => substr((string) $assignment->shift->start_time, 0, 5),
                'end_time' => substr((string) $assignment->shift->end_time, 0, 5),
                'color' => $assignment->shift->color,
            ] : null,
            'branch' => $assignment->branch ? [
                'id' => $assignment->branch->id,
                'name' => $assignment->branch->name,
            ] : null,
        ];
    }

    protected function assertNotInPast(Carbon $date): void
    {
        $today = Carbon::now(config('app.timezone'))->startOfDay();
        if ($date->lt($today)) {
            throw ValidationException::withMessages([
                'date' => ['Không xếp ca cho ngày trong quá khứ.'],
            ]);
        }
    }

    protected function assertNotOnApprovedLeave(int $employeeId, Carbon $date): void
    {
        $onLeave = LeaveRequest::query()
            ->where('employee_id', $employeeId)
            ->where('status', LeaveRequest::STATUS_APPROVED)
            ->whereDate('starts_on', '<=', $date->toDateString())
            ->whereDate('ends_on', '>=', $date->toDateString())
            ->exists();

        if ($onLeave) {
            throw ValidationException::withMessages([
                'date' => ['Nhân viên đang nghỉ phép đã duyệt trong ngày này, không xếp ca được.'],
            ]);
        }
    }
}
