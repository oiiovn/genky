<?php

namespace App\Services\Timesheet;

use App\Models\Employee;
use App\Models\MonthlyWorkSummary;
use App\Models\TimesheetApproval;
use App\Services\Employee\EmployeeService;
use App\Services\Work\MonthlyWorkSummaryService;
use App\Support\Authorization\TimesheetPermission;
use App\Support\Tenancy\TenantContext;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TimesheetService
{
    /** @var array<string, true> */
    private array $freshMonths = [];

    public function __construct(
        private readonly EmployeeService $employees,
        private readonly MonthlyWorkSummaryService $monthly,
    ) {
    }

    protected function ensureMonth(int $year, int $month): void
    {
        $key = $year.'-'.$month;
        if (isset($this->freshMonths[$key])) {
            return;
        }

        $this->monthly->ensureFresh($year, $month);
        $this->freshMonths[$key] = true;
    }

    /**
     * @return array{from: string, to: string, label: string}
     */
    public function monthBounds(int $year, int $month): array
    {
        $from = Carbon::create($year, $month, 1)->startOfDay();
        $to = $from->copy()->endOfMonth();

        return [
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'label' => sprintf('Tháng %02d/%d', $month, $year),
        ];
    }

    public function list(array $filters): array
    {
        TimesheetPermission::for()->assertCanViewAny();

        $year = (int) ($filters['year'] ?? now()->year);
        $month = (int) ($filters['month'] ?? now()->month);
        $bounds = $this->monthBounds($year, $month);
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 10)));

        $this->ensureMonth($year, $month);
        $query = $this->filteredEmployeeQuery($year, $month, $filters);
        $total = $this->countDistinctEmployees($query);
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);

        $ids = $query->clone()
            ->select('employees.id')
            ->orderBy('employees.full_name')
            ->orderBy('employees.id')
            ->forPage($page, $perPage)
            ->pluck('employees.id');

        $branchId = ! empty($filters['branch_id']) ? (int) $filters['branch_id'] : null;
        $rows = $this->hydrateByIds($ids, $year, $month, $branchId);

        return [
            'data' => $rows->all(),
            'meta' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
                'year' => $year,
                'month' => $month,
                'from' => $bounds['from'],
                'to' => $bounds['to'],
                'label' => $bounds['label'],
            ],
            'stats' => $this->computeStats($year, $month, $filters),
            'summary' => $this->approvalSummary($year, $month, $filters),
            'departments' => $this->departmentOptions($year, $month, $filters),
        ];
    }

    public function dashboard(array $filters): array
    {
        TimesheetPermission::for()->assertCanViewAny();

        $year = (int) ($filters['year'] ?? now()->year);
        $month = (int) ($filters['month'] ?? now()->month);

        return $this->computeStats($year, $month, $filters);
    }

    public function generate(array $data): array
    {
        TimesheetPermission::for()->assertCanManage();

        $year = (int) $data['year'];
        $month = (int) $data['month'];
        $branchId = ! empty($data['branch_id']) ? (int) $data['branch_id'] : null;

        if ($branchId) {
            TimesheetPermission::for()->assertCanAccessBranch($branchId);
        }

        $employeeIds = $this->scopedEmployeeQuery($branchId)->pluck('employees.id');
        $created = 0;

        foreach ($employeeIds as $employeeId) {
            $row = TimesheetApproval::query()->firstOrCreate(
                [
                    'organization_id' => TenantContext::id(),
                    'employee_id' => $employeeId,
                    'year' => $year,
                    'month' => $month,
                ],
                [
                    'status' => TimesheetApproval::STATUS_PENDING,
                ]
            );
            if ($row->wasRecentlyCreated) {
                $created++;
            }
        }

        return [
            'created' => $created,
            'total_employees' => $employeeIds->count(),
            'year' => $year,
            'month' => $month,
        ];
    }

    public function approve(array $data): array
    {
        TimesheetPermission::for()->assertCanManage();

        $year = (int) $data['year'];
        $month = (int) $data['month'];
        $ids = collect($data['employee_ids'] ?? [])->map(fn ($id) => (int) $id)->unique()->values();
        $status = $data['status'] ?? TimesheetApproval::STATUS_APPROVED;

        if (! in_array($status, [TimesheetApproval::STATUS_APPROVED, TimesheetApproval::STATUS_PENDING], true)) {
            $status = TimesheetApproval::STATUS_APPROVED;
        }

        $allowed = $this->scopedEmployeeQuery(null)->pluck('employees.id');
        $ids = $ids->filter(fn ($id) => $allowed->contains($id))->values();

        $count = 0;
        foreach ($ids as $employeeId) {
            $approval = TimesheetApproval::query()->updateOrCreate(
                [
                    'organization_id' => TenantContext::id(),
                    'employee_id' => $employeeId,
                    'year' => $year,
                    'month' => $month,
                ],
                [
                    'status' => $status,
                    'approved_by' => $status === TimesheetApproval::STATUS_APPROVED ? auth()->id() : null,
                    'approved_at' => $status === TimesheetApproval::STATUS_APPROVED ? now() : null,
                ]
            );
            $count++;
            unset($approval);
        }

        return [
            'count' => $count,
            'status' => $status,
            'year' => $year,
            'month' => $month,
        ];
    }

    public function export(array $filters): StreamedResponse
    {
        TimesheetPermission::for()->assertCanViewAny();

        $year = (int) ($filters['year'] ?? now()->year);
        $month = (int) ($filters['month'] ?? now()->month);
        $rows = $this->buildRows($year, $month, $filters);
        $filename = sprintf('timesheet-%04d-%02d.csv', $year, $month);

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, [
                'Mã NV',
                'Họ tên',
                'Phòng ban',
                'Ngày công',
                'Giờ làm (phút)',
                'OT (phút)',
                'Nghỉ phép',
                'Nghỉ khác',
                'Tổng ngày',
                'Trạng thái',
            ]);
            foreach ($rows as $row) {
                fputcsv($out, [
                    $row['employee']['employee_code'] ?? '',
                    $row['employee']['full_name'] ?? '',
                    $row['department'],
                    $row['work_days'],
                    $row['work_minutes'],
                    $row['ot_minutes'],
                    $row['leave_days'],
                    $row['other_leave_days'],
                    $row['total_days'],
                    $row['status'] === 'approved' ? 'Đã duyệt' : 'Chờ duyệt',
                ]);
            }
            fclose($out);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    protected function buildRows(int $year, int $month, array $filters): Collection
    {
        $this->ensureMonth($year, $month);
        $branchId = ! empty($filters['branch_id']) ? (int) $filters['branch_id'] : null;
        $ids = $this->filteredEmployeeQuery($year, $month, $filters)
            ->select('employees.id')
            ->orderBy('employees.full_name')
            ->orderBy('employees.id')
            ->pluck('employees.id');

        return $this->hydrateByIds($ids, $year, $month, $branchId);
    }

    protected function computeStats(int $year, int $month, array $filters): array
    {
        $current = $this->aggregateMonth($year, $month, $filters);
        $prev = Carbon::create($year, $month, 1)->subMonth();
        $previous = $this->aggregateMonth((int) $prev->year, (int) $prev->month, $filters);

        return [
            'employees' => $current['employees'],
            'work_minutes' => $current['work_minutes'],
            'ot_minutes' => $current['ot_minutes'],
            'avg_work_days' => $current['avg_work_days'],
            'estimated_cost' => $current['estimated_cost'],
            'employees_delta' => $current['employees'] - $previous['employees'],
            'work_hours_delta' => round(($current['work_minutes'] - $previous['work_minutes']) / 60, 1),
            'ot_delta' => round(($current['ot_minutes'] - $previous['ot_minutes']) / 60, 1),
            'avg_days_delta' => round($current['avg_work_days'] - $previous['avg_work_days'], 1),
            'cost_delta' => $current['estimated_cost'] - $previous['estimated_cost'],
        ];
    }

    /**
     * @return array{employees: int, work_minutes: int, ot_minutes: int, avg_work_days: float, estimated_cost: int}
     */
    protected function aggregateMonth(int $year, int $month, array $filters): array
    {
        $this->ensureMonth($year, $month);

        $branchId = ! empty($filters['branch_id']) ? (int) $filters['branch_id'] : null;
        if ($branchId) {
            TimesheetPermission::for()->assertCanAccessBranch($branchId);
        }

        $query = $this->scopedEmployeeQuery($branchId);
        $this->joinMonthSummary($query, $year, $month, $branchId);
        $this->applyTimesheetFilters($query, $year, $month, $filters);

        $row = $query
            ->toBase()
            ->selectRaw('count(distinct employees.id) as employees')
            ->selectRaw('coalesce(sum(mws.work_minutes), 0) as work_minutes')
            ->selectRaw('coalesce(sum(mws.ot_minutes), 0) as ot_minutes')
            ->selectRaw('avg(coalesce(mws.work_days, 0)) as avg_work_days')
            ->selectRaw(
                'coalesce(sum(case when employees.salary_type = ? then employees.salary_amount * coalesce(mws.work_minutes, 0) / 60.0 else (employees.salary_amount / 176.0) * coalesce(mws.work_minutes, 0) / 60.0 end), 0) as estimated_cost',
                ['hourly']
            )
            ->first();

        $employees = (int) ($row?->employees ?? 0);

        return [
            'employees' => $employees,
            'work_minutes' => (int) ($row?->work_minutes ?? 0),
            'ot_minutes' => (int) ($row?->ot_minutes ?? 0),
            'avg_work_days' => $employees > 0 ? round((float) ($row?->avg_work_days ?? 0), 1) : 0.0,
            'estimated_cost' => (int) round((float) ($row?->estimated_cost ?? 0)),
        ];
    }

    protected function joinMonthSummary(Builder $query, int $year, int $month, ?int $branchId): void
    {
        $orgId = TenantContext::id();
        $query->leftJoin('monthly_work_summaries as mws', function ($join) use ($year, $month, $branchId, $orgId) {
            $join->on('mws.employee_id', '=', 'employees.id')
                ->where('mws.year', '=', $year)
                ->where('mws.month', '=', $month)
                ->where('mws.branch_id', '=', $branchId ?: 0);
            if ($orgId) {
                $join->where('mws.organization_id', '=', $orgId);
            }
        });
    }

    protected function applyTimesheetFilters(Builder $query, int $year, int $month, array $filters): void
    {
        $department = trim((string) ($filters['department'] ?? ''));
        $shiftId = ! empty($filters['shift_id']) ? (int) $filters['shift_id'] : null;
        $status = trim((string) ($filters['status'] ?? ''));
        $search = trim((string) ($filters['search'] ?? ''));

        if ($department !== '') {
            $query->whereHas('position', fn (Builder $q) => $q->where('name', $department));
        }

        if ($search !== '') {
            $like = '%'.addcslashes($search, '%_\\').'%';
            $query->where(function (Builder $inner) use ($like) {
                $inner->where('employees.full_name', 'like', $like)
                    ->orWhere('employees.employee_code', 'like', $like)
                    ->orWhereHas('position', fn (Builder $position) => $position->where('name', 'like', $like));
            });
        }

        if ($shiftId) {
            $needle = '"id":'.$shiftId;
            $query->where(function (Builder $inner) use ($needle) {
                $inner->where('mws.shifts', 'like', '%'.$needle.',%')
                    ->orWhere('mws.shifts', 'like', '%'.$needle.'}%');
            });
        }

        if ($status === '') {
            return;
        }

        $this->joinApprovals($query, $year, $month);

        if ($status === TimesheetApproval::STATUS_APPROVED) {
            $query->where('ta.status', TimesheetApproval::STATUS_APPROVED);
        } elseif ($status === TimesheetApproval::STATUS_PENDING) {
            $query->where(function (Builder $inner) {
                $inner->whereNull('ta.id')
                    ->orWhere('ta.status', TimesheetApproval::STATUS_PENDING);
            });
        }
    }

    protected function filteredEmployeeQuery(int $year, int $month, array $filters): Builder
    {
        $branchId = ! empty($filters['branch_id']) ? (int) $filters['branch_id'] : null;
        if ($branchId) {
            TimesheetPermission::for()->assertCanAccessBranch($branchId);
        }

        $query = $this->scopedEmployeeQuery($branchId);
        $this->joinMonthSummary($query, $year, $month, $branchId);
        $this->applyTimesheetFilters($query, $year, $month, $filters);

        return $query;
    }

    protected function countDistinctEmployees(Builder $query): int
    {
        return (int) $query->clone()
            ->toBase()
            ->getCountForPagination(['employees.id']);
    }

    /**
     * @return array{approved: int, pending: int}
     */
    protected function approvalSummary(int $year, int $month, array $filters): array
    {
        $query = $this->filteredEmployeeQuery($year, $month, $filters);
        $this->joinApprovals($query, $year, $month);

        $row = $query
            ->toBase()
            ->selectRaw(
                "coalesce(sum(case when ta.status = ? then 1 else 0 end), 0) as approved",
                [TimesheetApproval::STATUS_APPROVED]
            )
            ->selectRaw('count(distinct employees.id) as total')
            ->first();

        $total = (int) ($row?->total ?? 0);
        $approved = (int) ($row?->approved ?? 0);

        return [
            'approved' => $approved,
            'pending' => max(0, $total - $approved),
        ];
    }

    /**
     * @return list<string>
     */
    protected function departmentOptions(int $year, int $month, array $filters): array
    {
        return $this->filteredEmployeeQuery($year, $month, $filters)
            ->leftJoin('positions as pos_dept', 'pos_dept.id', '=', 'employees.position_id')
            ->whereNotNull('pos_dept.name')
            ->where('pos_dept.name', '!=', '—')
            ->distinct()
            ->orderBy('pos_dept.name')
            ->pluck('pos_dept.name')
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, int>  $ids
     * @return Collection<int, array<string, mixed>>
     */
    protected function hydrateByIds(Collection $ids, int $year, int $month, ?int $branchId): Collection
    {
        $ids = $ids->map(fn ($id) => (int) $id)->unique()->values();
        if ($ids->isEmpty()) {
            return collect();
        }

        $employees = Employee::query()
            ->with(['position', 'role', 'branches'])
            ->whereIn('id', $ids)
            ->get()
            ->keyBy('id');

        $summaries = MonthlyWorkSummary::query()
            ->where('year', $year)
            ->where('month', $month)
            ->where('branch_id', $branchId ?: 0)
            ->whereIn('employee_id', $ids)
            ->get()
            ->keyBy('employee_id');

        $approvals = TimesheetApproval::query()
            ->whereIn('employee_id', $ids)
            ->where('year', $year)
            ->where('month', $month)
            ->get()
            ->keyBy('employee_id');

        return $ids->map(function (int $id) use ($employees, $summaries, $approvals) {
            $employee = $employees->get($id);
            if (! $employee) {
                return null;
            }

            return $this->hydrateRow(
                $employee,
                $summaries->get($id),
                $approvals->get($id),
            );
        })->filter()->values();
    }

    protected function joinApprovals(Builder $query, int $year, int $month): void
    {
        $joins = $query->getQuery()->joins ?? [];
        foreach ($joins as $join) {
            if (($join->table ?? '') === 'timesheet_approvals as ta') {
                return;
            }
        }

        $orgId = TenantContext::id();
        $query->leftJoin('timesheet_approvals as ta', function ($join) use ($year, $month, $orgId) {
            $join->on('ta.employee_id', '=', 'employees.id')
                ->where('ta.year', '=', $year)
                ->where('ta.month', '=', $month);
            if ($orgId) {
                $join->where('ta.organization_id', '=', $orgId);
            }
        });
    }

    protected function hydrateRow(
        Employee $employee,
        ?MonthlyWorkSummary $summary,
        ?TimesheetApproval $approval,
    ): array {
        $workDays = (int) ($summary?->work_days ?? 0);
        $workMinutes = (int) ($summary?->work_minutes ?? 0);
        $otMinutes = (int) ($summary?->ot_minutes ?? 0);
        $leaveDays = (int) ($summary?->leave_days ?? 0);
        $otherLeave = (int) ($summary?->other_leave_days ?? 0);

        return [
            'id' => $employee->id,
            'employee' => $this->employees->payload($employee),
            'department' => $employee->position?->name ?? '—',
            'shifts' => $summary?->shifts ?? [],
            'work_days' => $workDays,
            'work_minutes' => $workMinutes,
            'ot_minutes' => $otMinutes,
            'leave_days' => $leaveDays,
            'other_leave_days' => $otherLeave,
            'total_days' => $workDays + $leaveDays + $otherLeave,
            'status' => $approval?->status ?? TimesheetApproval::STATUS_PENDING,
            'branch_ids' => $employee->branches->pluck('id')->values()->all(),
            'approved_at' => $approval?->approved_at?->toIso8601String(),
        ];
    }

    protected function scopedEmployeeQuery(?int $branchId): Builder
    {
        $permission = TimesheetPermission::for();

        $query = Employee::query()->where('employees.status', Employee::STATUS_ACTIVE);

        if ($permission->isEmployeeOnly()) {
            $query->where('employees.id', $permission->ownEmployee()?->id ?? 0);
        } elseif ($permission->isManager()) {
            $managed = $permission->managedBranchIds();
            $query->whereHas('branches', fn ($q) => $q->whereIn('branches.id', $managed));
            if ($branchId) {
                $query->whereHas('branches', fn ($q) => $q->where('branches.id', $branchId));
            }
        } elseif ($branchId) {
            $query->whereHas('branches', fn ($q) => $q->where('branches.id', $branchId));
        }

        return $query;
    }
}
