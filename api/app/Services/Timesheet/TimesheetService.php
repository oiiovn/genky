<?php

namespace App\Services\Timesheet;

use App\Models\AttendanceLog;
use App\Models\Employee;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Models\TimesheetApproval;
use App\Services\Employee\EmployeeService;
use App\Support\Authorization\TimesheetPermission;
use App\Support\Tenancy\TenantContext;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TimesheetService
{
    public function __construct(private readonly EmployeeService $employees)
    {
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

        $rows = $this->buildRows($year, $month, $filters);
        $stats = $this->computeStats($rows, $year, $month, $filters);

        $total = $rows->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);
        $slice = $rows->slice(($page - 1) * $perPage, $perPage)->values();

        $departments = $rows
            ->pluck('department')
            ->filter(fn ($d) => $d && $d !== '—')
            ->unique()
            ->sort()
            ->values()
            ->all();

        return [
            'data' => $slice->all(),
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
            'stats' => $stats,
            'summary' => [
                'approved' => $rows->where('status', TimesheetApproval::STATUS_APPROVED)->count(),
                'pending' => $rows->where('status', TimesheetApproval::STATUS_PENDING)->count(),
            ],
            'departments' => $departments,
        ];
    }

    public function dashboard(array $filters): array
    {
        TimesheetPermission::for()->assertCanViewAny();

        $year = (int) ($filters['year'] ?? now()->year);
        $month = (int) ($filters['month'] ?? now()->month);
        $rows = $this->buildRows($year, $month, $filters);

        return $this->computeStats($rows, $year, $month, $filters);
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

        $employees = $this->scopedEmployees($branchId);
        $created = 0;

        foreach ($employees as $employee) {
            $row = TimesheetApproval::query()->firstOrCreate(
                [
                    'organization_id' => TenantContext::id(),
                    'employee_id' => $employee->id,
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
            'total_employees' => $employees->count(),
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

        $allowed = $this->scopedEmployees(null)->pluck('id');
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
        $bounds = $this->monthBounds($year, $month);
        $branchId = ! empty($filters['branch_id']) ? (int) $filters['branch_id'] : null;
        $shiftId = ! empty($filters['shift_id']) ? (int) $filters['shift_id'] : null;
        $department = trim((string) ($filters['department'] ?? ''));
        $status = trim((string) ($filters['status'] ?? ''));
        $search = mb_strtolower(trim((string) ($filters['search'] ?? '')));

        if ($branchId) {
            TimesheetPermission::for()->assertCanAccessBranch($branchId);
        }

        $employees = $this->scopedEmployees($branchId);
        $employeeIds = $employees->pluck('id');

        $logs = AttendanceLog::query()
            ->with('shift')
            ->whereIn('employee_id', $employeeIds)
            ->whereBetween('work_date', [$bounds['from'], $bounds['to']])
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->get()
            ->groupBy('employee_id');

        $assignments = ShiftAssignment::query()
            ->with('shift')
            ->whereIn('employee_id', $employeeIds)
            ->whereBetween('date', [$bounds['from'], $bounds['to']])
            ->where('status', ShiftAssignment::STATUS_ASSIGNED)
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->get()
            ->groupBy('employee_id');

        $approvals = TimesheetApproval::query()
            ->whereIn('employee_id', $employeeIds)
            ->where('year', $year)
            ->where('month', $month)
            ->get()
            ->keyBy('employee_id');

        $rows = $employees->map(function (Employee $employee) use ($logs, $assignments, $approvals) {
            /** @var Collection<int, AttendanceLog> $empLogs */
            $empLogs = $logs->get($employee->id, collect());
            /** @var Collection<int, ShiftAssignment> $empAssignments */
            $empAssignments = $assignments->get($employee->id, collect());

            $leaveDays = $empLogs->where('status', AttendanceLog::STATUS_LEAVE)->count();
            $otherLeave = $empLogs->where('status', AttendanceLog::STATUS_ABSENT)->count();

            $workedLogs = $empLogs->filter(function (AttendanceLog $log) {
                return in_array($log->status, [
                    AttendanceLog::STATUS_WORKING,
                    AttendanceLog::STATUS_CHECKED_OUT,
                ], true) || $log->check_in_at !== null;
            });

            $workDates = $workedLogs->map(fn (AttendanceLog $log) => $log->work_date?->toDateString())->filter()->unique();
            $workMinutes = 0;
            $shiftMap = [];

            if ($workedLogs->isNotEmpty()) {
                foreach ($workedLogs as $log) {
                    $mins = $log->total_minutes;
                    if ($mins === null && $log->check_in_at && $log->check_out_at) {
                        $mins = max(0, $log->check_in_at->diffInMinutes($log->check_out_at) - (int) $log->break_minutes);
                    }
                    $workMinutes += (int) ($mins ?? 0);

                    if ($log->shift) {
                        $shiftMap[$log->shift->id] = $this->shiftBadge($log->shift);
                    }
                }
            } else {
                $workDates = $empAssignments->map(fn (ShiftAssignment $a) => $a->date?->toDateString())->filter()->unique();
                foreach ($empAssignments as $assignment) {
                    if (! $assignment->shift) {
                        continue;
                    }
                    $workMinutes += $this->shiftMinutes($assignment->shift);
                    $shiftMap[$assignment->shift->id] = $this->shiftBadge($assignment->shift);
                }
            }

            // Include shifts from assignments even when attendance exists
            foreach ($empAssignments as $assignment) {
                if ($assignment->shift && ! isset($shiftMap[$assignment->shift->id])) {
                    $shiftMap[$assignment->shift->id] = $this->shiftBadge($assignment->shift);
                }
            }

            $workDays = $workDates->count();
            $standard = $workDays * 8 * 60;
            $otMinutes = max(0, $workMinutes - $standard);
            $approval = $approvals->get($employee->id);
            $rowStatus = $approval?->status ?? TimesheetApproval::STATUS_PENDING;

            return [
                'id' => $employee->id,
                'employee' => $this->employees->payload($employee),
                'department' => $employee->position?->name ?? '—',
                'shifts' => array_values($shiftMap),
                'work_days' => $workDays,
                'work_minutes' => $workMinutes,
                'ot_minutes' => $otMinutes,
                'leave_days' => $leaveDays,
                'other_leave_days' => $otherLeave,
                'total_days' => $workDays + $leaveDays + $otherLeave,
                'status' => $rowStatus,
                'branch_ids' => $employee->branches->pluck('id')->values()->all(),
                'approved_at' => $approval?->approved_at?->toIso8601String(),
            ];
        });

        return $rows
            ->filter(function (array $row) use ($department, $shiftId, $status, $search) {
                if ($department !== '' && $row['department'] !== $department) {
                    return false;
                }
                if ($shiftId && ! collect($row['shifts'])->contains(fn ($s) => (int) $s['id'] === $shiftId)) {
                    return false;
                }
                if ($status !== '' && $row['status'] !== $status) {
                    return false;
                }
                if ($search !== '') {
                    $hay = mb_strtolower(
                        ($row['employee']['full_name'] ?? '').' '.
                        ($row['employee']['employee_code'] ?? '').' '.
                        $row['department']
                    );
                    if (! str_contains($hay, $search)) {
                        return false;
                    }
                }

                return true;
            })
            ->values();
    }

    protected function computeStats(Collection $rows, int $year, int $month, array $filters): array
    {
        $employees = $rows->count();
        $workMinutes = (int) $rows->sum('work_minutes');
        $otMinutes = (int) $rows->sum('ot_minutes');
        $avgWorkDays = $employees > 0 ? round($rows->sum('work_days') / $employees, 1) : 0.0;
        $estimatedCost = (int) round($rows->sum(function (array $row) {
            $salaryType = $row['employee']['salary_type'] ?? 'monthly';
            $amount = (float) ($row['employee']['salary_amount'] ?? 0);
            $hourly = $salaryType === 'hourly' ? $amount : $amount / 176;

            return ($hourly * $row['work_minutes']) / 60;
        }));

        $prev = Carbon::create($year, $month, 1)->subMonth();
        $prevRows = $this->buildRows((int) $prev->year, (int) $prev->month, $filters);
        $prevStats = [
            'employees' => $prevRows->count(),
            'work_minutes' => (int) $prevRows->sum('work_minutes'),
            'ot_minutes' => (int) $prevRows->sum('ot_minutes'),
            'avg_work_days' => $prevRows->count() > 0
                ? round($prevRows->sum('work_days') / $prevRows->count(), 1)
                : 0.0,
            'estimated_cost' => (int) round($prevRows->sum(function (array $row) {
                $salaryType = $row['employee']['salary_type'] ?? 'monthly';
                $amount = (float) ($row['employee']['salary_amount'] ?? 0);
                $hourly = $salaryType === 'hourly' ? $amount : $amount / 176;

                return ($hourly * $row['work_minutes']) / 60;
            })),
        ];

        return [
            'employees' => $employees,
            'work_minutes' => $workMinutes,
            'ot_minutes' => $otMinutes,
            'avg_work_days' => $avgWorkDays,
            'estimated_cost' => $estimatedCost,
            'employees_delta' => $employees - $prevStats['employees'],
            'work_hours_delta' => round(($workMinutes - $prevStats['work_minutes']) / 60, 1),
            'ot_delta' => round(($otMinutes - $prevStats['ot_minutes']) / 60, 1),
            'avg_days_delta' => round($avgWorkDays - $prevStats['avg_work_days'], 1),
            'cost_delta' => $estimatedCost - $prevStats['estimated_cost'],
        ];
    }

    /**
     * @return Collection<int, Employee>
     */
    protected function scopedEmployees(?int $branchId): Collection
    {
        $permission = TimesheetPermission::for();

        $query = Employee::query()
            ->with(['position', 'branches'])
            ->where('status', Employee::STATUS_ACTIVE)
            ->orderBy('full_name');

        if ($permission->isEmployeeOnly()) {
            $own = $permission->ownEmployee();
            $query->where('id', $own?->id ?? 0);
        } elseif ($permission->isManager()) {
            $managed = $permission->managedBranchIds();
            $query->whereHas('branches', fn ($q) => $q->whereIn('branches.id', $managed));
            if ($branchId) {
                $query->whereHas('branches', fn ($q) => $q->where('branches.id', $branchId));
            }
        } elseif ($branchId) {
            $query->whereHas('branches', fn ($q) => $q->where('branches.id', $branchId));
        }

        return $query->get();
    }

    protected function shiftBadge(Shift $shift): array
    {
        return [
            'id' => $shift->id,
            'name' => $shift->name,
            'color' => $shift->color ?? '#6366F1',
            'start_time' => substr((string) $shift->start_time, 0, 5),
            'end_time' => substr((string) $shift->end_time, 0, 5),
        ];
    }

    protected function shiftMinutes(Shift $shift): int
    {
        $start = substr((string) $shift->start_time, 0, 5);
        $end = substr((string) $shift->end_time, 0, 5);
        [$sh, $sm] = array_map('intval', explode(':', $start));
        [$eh, $em] = array_map('intval', explode(':', $end));
        $mins = ($eh * 60 + $em) - ($sh * 60 + $sm);
        if ($mins <= 0) {
            $mins += 24 * 60;
        }

        return max(0, $mins - (int) $shift->break_minutes);
    }
}
