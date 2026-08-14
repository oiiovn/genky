<?php

namespace App\Services\Shift;

use App\Models\Branch;
use App\Models\Employee;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Support\Authorization\ShiftPermission;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Collection;
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

        $exists = ShiftAssignment::query()
            ->where('employee_id', $employee->id)
            ->where('shift_id', $shift->id)
            ->where('branch_id', $branch->id)
            ->whereDate('date', $data['date'])
            ->where('status', ShiftAssignment::STATUS_ASSIGNED)
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'employee_id' => ['Nhân viên đã được phân ca này trong ngày.'],
            ]);
        }

        return ShiftAssignment::query()->create([
            'organization_id' => TenantContext::id(),
            'employee_id' => $employee->id,
            'shift_id' => $shift->id,
            'branch_id' => $branch->id,
            'date' => $data['date'],
            'status' => ShiftAssignment::STATUS_ASSIGNED,
            'note' => $data['note'] ?? null,
        ])->load(['employee', 'shift', 'branch']);
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
}
