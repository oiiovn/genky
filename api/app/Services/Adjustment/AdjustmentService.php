<?php

namespace App\Services\Adjustment;

use App\Models\Employee;
use App\Models\EmployeeAdjustment;
use App\Support\Authorization\AdjustmentPermission;
use App\Support\Tenancy\TenantContext;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

class AdjustmentService
{
    public function list(array $filters = []): array
    {
        AdjustmentPermission::for()->assertCanViewAny();

        $year = (int) ($filters['year'] ?? now('Asia/Ho_Chi_Minh')->year);
        $month = (int) ($filters['month'] ?? now('Asia/Ho_Chi_Minh')->month);
        $from = Carbon::create($year, $month, 1)->startOfDay();
        $to = $from->copy()->endOfMonth();

        $query = $this->scopedQuery()
            ->with(['employee.position', 'employee.branches', 'creator'])
            ->whereBetween('occurred_on', [$from->toDateString(), $to->toDateString()])
            ->orderByDesc('occurred_on')
            ->orderByDesc('id');

        $rows = $query->limit(500)->get();
        $prevFrom = $from->copy()->subMonth()->startOfMonth();
        $prevTo = $prevFrom->copy()->endOfMonth();
        $prevRows = $this->scopedQuery()
            ->whereBetween('occurred_on', [$prevFrom->toDateString(), $prevTo->toDateString()])
            ->get();

        return [
            'data' => $rows->map(fn (EmployeeAdjustment $row) => $this->payload($row))->values()->all(),
            'stats' => $this->statsFrom($rows, $prevRows),
            'meta' => [
                'year' => $year,
                'month' => $month,
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'label' => sprintf('Tháng %02d/%d', $month, $year),
            ],
        ];
    }

    public function findOrFail(int $id): EmployeeAdjustment
    {
        $row = EmployeeAdjustment::query()
            ->with(['employee.position', 'employee.branches', 'creator'])
            ->findOrFail($id);
        AdjustmentPermission::for()->assertCanView($row);

        return $row;
    }

    public function create(array $data): array
    {
        $permission = AdjustmentPermission::for();
        $permission->assertCanManage();

        $employee = $this->resolveEmployee((int) $data['employee_id']);
        $permission->assertCanAccessEmployee($employee);
        $this->assertCategoryMatchesType($data['type'], $data['category']);

        $row = EmployeeAdjustment::query()->create([
            'organization_id' => TenantContext::id(),
            'employee_id' => $employee->id,
            'type' => $data['type'],
            'category' => $data['category'],
            'reason' => trim((string) $data['reason']),
            'amount' => (int) $data['amount'],
            'occurred_on' => Carbon::parse($data['date'])->toDateString(),
            'created_by' => auth()->id(),
        ]);

        return $this->payload($row->load(['employee.position', 'employee.branches', 'creator']));
    }

    public function update(EmployeeAdjustment $row, array $data): array
    {
        $permission = AdjustmentPermission::for();
        $permission->assertCanManage();

        $employee = $this->resolveEmployee((int) ($data['employee_id'] ?? $row->employee_id));
        $permission->assertCanAccessEmployee($employee);
        $this->assertCategoryMatchesType($data['type'], $data['category']);

        $row->forceFill([
            'employee_id' => $employee->id,
            'type' => $data['type'],
            'category' => $data['category'],
            'reason' => trim((string) $data['reason']),
            'amount' => (int) $data['amount'],
            'occurred_on' => Carbon::parse($data['date'])->toDateString(),
        ])->save();

        return $this->payload($row->fresh(['employee.position', 'employee.branches', 'creator']));
    }

    public function delete(EmployeeAdjustment $row): void
    {
        AdjustmentPermission::for()->assertCanManage();
        $row->delete();
    }

    public function payload(EmployeeAdjustment $row): array
    {
        $row->loadMissing(['employee.position', 'employee.branches', 'creator']);
        $employee = $row->employee;

        return [
            'id' => $row->id,
            'employee_id' => $row->employee_id,
            'employee_code' => $employee?->employee_code,
            'full_name' => $employee?->full_name,
            'avatar' => $employee?->resolvedAvatarUrl(),
            'department' => $employee?->position?->name ?? '—',
            'type' => $row->type,
            'category' => $row->category,
            'reason' => $row->reason,
            'amount' => (int) $row->amount,
            'date' => $row->occurred_on?->toDateString(),
            'created_by' => $row->creator?->name ?? '—',
            'branch_ids' => $employee?->branches?->pluck('id')->values()->all() ?? [],
        ];
    }

    protected function scopedQuery()
    {
        $permission = AdjustmentPermission::for();
        $query = EmployeeAdjustment::query();

        if ($permission->isEmployeeOnly()) {
            $own = $permission->ownEmployee();
            $query->where('employee_id', $own?->id ?? 0);
        } elseif ($permission->isManager() && ! $permission->isOrgWide()) {
            $managed = $permission->managedBranchIds();
            $query->whereHas(
                'employee.branches',
                fn ($q) => $q->whereIn('branches.id', $managed)
            );
        }

        return $query;
    }

    protected function resolveEmployee(int $id): Employee
    {
        $employee = Employee::query()->with(['position', 'branches'])->find($id);
        if (! $employee) {
            throw ValidationException::withMessages([
                'employee_id' => ['Không tìm thấy nhân viên.'],
            ]);
        }

        return $employee;
    }

    protected function assertCategoryMatchesType(string $type, string $category): void
    {
        $ok = $type === EmployeeAdjustment::TYPE_REWARD
            ? in_array($category, EmployeeAdjustment::REWARD_CATEGORIES, true)
            : in_array($category, EmployeeAdjustment::PENALTY_CATEGORIES, true);

        if (! $ok) {
            throw ValidationException::withMessages([
                'category' => ['Loại lý do không khớp với thưởng/phạt.'],
            ]);
        }
    }

    /**
     * @param  \Illuminate\Support\Collection<int, EmployeeAdjustment>  $rows
     * @param  \Illuminate\Support\Collection<int, EmployeeAdjustment>  $prev
     * @return array<string, mixed>
     */
    protected function statsFrom($rows, $prev): array
    {
        $rewards = $rows->where('type', EmployeeAdjustment::TYPE_REWARD);
        $penalties = $rows->where('type', EmployeeAdjustment::TYPE_PENALTY);
        $rewardTotal = (int) $rewards->sum('amount');
        $penaltyTotal = (int) $penalties->sum('amount');
        $prevReward = (int) $prev->where('type', EmployeeAdjustment::TYPE_REWARD)->sum('amount');
        $prevPenalty = (int) $prev->where('type', EmployeeAdjustment::TYPE_PENALTY)->sum('amount');
        $recorded = $rewardTotal + $penaltyTotal;
        $prevRecorded = $prevReward + $prevPenalty;

        return [
            'reward_total' => $rewardTotal,
            'penalty_total' => $penaltyTotal,
            'recorded_total' => $recorded,
            'rewarded_employees' => $rewards->pluck('employee_id')->unique()->count(),
            'penalized_employees' => $penalties->pluck('employee_id')->unique()->count(),
            'reward_delta' => $this->percentDelta($rewardTotal, $prevReward),
            'penalty_delta' => $this->percentDelta($penaltyTotal, $prevPenalty),
            'recorded_delta' => $this->percentDelta($recorded, $prevRecorded),
        ];
    }

    protected function percentDelta(int $current, int $previous): float
    {
        if ($previous === 0) {
            return $current > 0 ? 100.0 : 0.0;
        }

        return round((($current - $previous) / $previous) * 100, 1);
    }
}
