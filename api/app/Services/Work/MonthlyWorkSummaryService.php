<?php

namespace App\Services\Work;

use App\Models\AttendanceLog;
use App\Models\Employee;
use App\Models\MonthlyWorkSummary;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Support\Tenancy\TenantContext;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class MonthlyWorkSummaryService
{
    /**
     * @return Collection<int, MonthlyWorkSummary>
     */
    public function forMonth(int $year, int $month, ?int $branchId = null): Collection
    {
        $this->ensureTable();
        $this->ensureFresh($year, $month);

        return MonthlyWorkSummary::query()
            ->where('year', $year)
            ->where('month', $month)
            ->where('branch_id', $branchId ?: 0)
            ->get()
            ->keyBy('employee_id');
    }

    public function ensureTable(): void
    {
        if (Schema::hasTable('monthly_work_summaries')) {
            return;
        }

        try {
            Artisan::call('migrate', [
                '--force' => true,
                '--no-interaction' => true,
                '--path' => 'database/migrations/2026_08_15_130000_create_monthly_work_summaries_table.php',
            ]);
        } catch (\Throwable) {
            // Message below if the table is still missing.
        }

        if (! Schema::hasTable('monthly_work_summaries')) {
            throw ValidationException::withMessages([
                'summary' => [
                    'Chưa cập nhật cơ sở dữ liệu. Vui lòng chạy php artisan migrate --force.',
                ],
            ]);
        }
    }

    public function ensureFresh(int $year, int $month): void
    {
        $this->ensureTable();

        if (! TenantContext::id()) {
            return;
        }

        $bounds = $this->monthBounds($year, $month);
        $until = Carbon::parse($bounds['to'])->addDay()->toDateString();
        $computedAt = MonthlyWorkSummary::query()
            ->where('year', $year)
            ->where('month', $month)
            ->max('computed_at');

        $sourceAt = collect([
            AttendanceLog::query()
                ->where('work_date', '>=', $bounds['from'])
                ->where('work_date', '<', $until)
                ->max('updated_at'),
            ShiftAssignment::query()
                ->where('date', '>=', $bounds['from'])
                ->where('date', '<', $until)
                ->max('updated_at'),
            Employee::query()->max('updated_at'),
        ])->filter()->max();

        if ($computedAt && (! $sourceAt || Carbon::parse((string) $computedAt)->gte(Carbon::parse((string) $sourceAt)))) {
            return;
        }

        $this->rebuild($year, $month);
    }

    public function rebuild(int $year, int $month): void
    {
        $this->ensureTable();

        if (! TenantContext::id()) {
            return;
        }

        $now = now();
        $orgId = TenantContext::id();
        $rows = [];

        foreach ($this->computeAllBranches($year, $month) as $row) {
            $rows[] = [
                ...$row,
                'organization_id' => $orgId,
                'shifts' => json_encode($row['shifts'] ?? []),
                'computed_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        DB::transaction(function () use ($year, $month, $rows) {
            MonthlyWorkSummary::query()
                ->where('year', $year)
                ->where('month', $month)
                ->delete();

            foreach (array_chunk($rows, 200) as $chunk) {
                MonthlyWorkSummary::query()->insert($chunk);
            }
        });
    }

    /**
     * @return Collection<int, array<string, mixed>>
     */
    protected function computeAllBranches(int $year, int $month): Collection
    {
        $bounds = $this->monthBounds($year, $month);

        $until = Carbon::parse($bounds['to'])->addDay()->toDateString();

        $logs = AttendanceLog::query()
            ->with('shift')
            ->where('work_date', '>=', $bounds['from'])
            ->where('work_date', '<', $until)
            ->get();

        $assignments = ShiftAssignment::query()
            ->with('shift')
            ->where('date', '>=', $bounds['from'])
            ->where('date', '<', $until)
            ->where('status', ShiftAssignment::STATUS_ASSIGNED)
            ->get();

        $logsByEmployee = $logs->groupBy('employee_id');
        $assignmentsByEmployee = $assignments->groupBy('employee_id');
        $employeeIds = $logsByEmployee->keys()
            ->merge($assignmentsByEmployee->keys())
            ->merge(
                Employee::query()->where('status', Employee::STATUS_ACTIVE)->pluck('id')
            )
            ->unique()
            ->values();

        $rows = collect();
        foreach ($employeeIds as $employeeId) {
            $empLogs = $logsByEmployee->get($employeeId, collect())->values();
            $empAssignments = $assignmentsByEmployee->get($employeeId, collect())->values();

            $rows->push($this->aggregate((int) $employeeId, $year, $month, 0, $empLogs, $empAssignments));

            $branchIds = $empLogs->pluck('branch_id')
                ->merge($empAssignments->pluck('branch_id'))
                ->filter()
                ->unique();

            foreach ($branchIds as $branchId) {
                $rows->push($this->aggregate(
                    (int) $employeeId,
                    $year,
                    $month,
                    (int) $branchId,
                    $empLogs->where('branch_id', $branchId)->values(),
                    $empAssignments->where('branch_id', $branchId)->values(),
                ));
            }
        }

        return $rows->values();
    }

    /**
     * @param  Collection<int, AttendanceLog>  $empLogs
     * @param  Collection<int, ShiftAssignment>  $empAssignments
     * @return array<string, mixed>
     */
    protected function aggregate(
        int $employeeId,
        int $year,
        int $month,
        int $branchId,
        Collection $empLogs,
        Collection $empAssignments,
    ): array {
        $leaveLogs = $empLogs->filter(fn (AttendanceLog $log) => $log->isLeave());
        $paidLeaveLogs = $leaveLogs->filter(fn (AttendanceLog $log) => $log->isPaidLeave());
        $unpaidLeaveLogs = $leaveLogs->filter(fn (AttendanceLog $log) => ! $log->isPaidLeave());

        $workedLogs = $empLogs->filter(function (AttendanceLog $log) {
            if ($log->isLeave() || $log->status === AttendanceLog::STATUS_ABSENT) {
                return false;
            }

            return in_array($log->status, [
                AttendanceLog::STATUS_WORKING,
                AttendanceLog::STATUS_CHECKED_OUT,
            ], true) || $log->check_in_at !== null;
        });

        $workedMinutes = 0;
        $shiftMap = [];
        foreach ($workedLogs as $log) {
            $workedMinutes += $this->logMinutes($log);
            if ($log->shift) {
                $shiftMap[$log->shift->id] = $this->shiftBadge($log->shift);
            }
        }

        $paidLeaveMinutes = 0;
        foreach ($paidLeaveLogs as $log) {
            $paidLeaveMinutes += $this->leaveDayMinutes($log, $empAssignments);
        }

        $unpaidLeaveMinutes = 0;
        foreach ($unpaidLeaveLogs as $log) {
            $unpaidLeaveMinutes += $this->leaveDayMinutes($log, $empAssignments);
        }

        $assignmentMinutes = 0;
        $assignmentDates = collect();
        foreach ($empAssignments as $assignment) {
            if (! $assignment->shift) {
                continue;
            }
            $assignmentMinutes += $this->shiftMinutes($assignment->shift);
            $assignmentDates->push($assignment->date?->toDateString());
            if (! isset($shiftMap[$assignment->shift->id])) {
                $shiftMap[$assignment->shift->id] = $this->shiftBadge($assignment->shift);
            }
        }

        $leaveDays = $leaveLogs->count();
        $payrollTotal = $workedMinutes + $paidLeaveMinutes;
        if ($workedLogs->isEmpty() && $leaveDays === 0 && $assignmentMinutes > 0) {
            $payrollTotal = $assignmentMinutes;
        }

        if ($workedLogs->isNotEmpty()) {
            $workDates = $workedLogs->map(fn (AttendanceLog $log) => $log->work_date?->toDateString())->filter()->unique();
            $workMinutes = $workedMinutes;
        } else {
            $workDates = $assignmentDates->filter()->unique();
            $workMinutes = $assignmentMinutes;
        }

        $workDays = $workDates->count();

        return [
            'employee_id' => $employeeId,
            'year' => $year,
            'month' => $month,
            'branch_id' => $branchId,
            'work_days' => $workDays,
            'work_minutes' => $workMinutes,
            'ot_minutes' => max(0, $workMinutes - ($workDays * 8 * 60)),
            'leave_days' => $empLogs->where('status', AttendanceLog::STATUS_LEAVE)->count(),
            'other_leave_days' => $empLogs->where('status', AttendanceLog::STATUS_ABSENT)->count(),
            'payroll_leave_days' => $leaveDays,
            'payroll_paid_leave_days' => $paidLeaveLogs->count(),
            'payroll_unpaid_days' => $unpaidLeaveLogs->count(),
            'payroll_worked_minutes' => $workedMinutes,
            'payroll_paid_leave_minutes' => $paidLeaveMinutes,
            'payroll_unpaid_leave_minutes' => $unpaidLeaveMinutes,
            'payroll_assignment_minutes' => $workedLogs->isEmpty() && $leaveDays === 0 ? $assignmentMinutes : 0,
            'payroll_total_minutes' => $payrollTotal,
            'shifts' => array_values($shiftMap),
        ];
    }

    /**
     * @return array{from: string, to: string}
     */
    protected function monthBounds(int $year, int $month): array
    {
        $from = Carbon::create($year, $month, 1)->startOfDay();

        return [
            'from' => $from->toDateString(),
            'to' => $from->copy()->endOfMonth()->toDateString(),
        ];
    }

    protected function logMinutes(AttendanceLog $log): int
    {
        $mins = $log->total_minutes;
        if ($mins === null && $log->check_in_at && $log->check_out_at) {
            $mins = max(0, $log->check_in_at->diffInMinutes($log->check_out_at) - (int) $log->break_minutes);
        }

        return (int) ($mins ?? 0);
    }

    /**
     * @param  Collection<int, ShiftAssignment>  $assignments
     */
    protected function leaveDayMinutes(AttendanceLog $log, Collection $assignments): int
    {
        if ($log->shift) {
            return $this->shiftMinutes($log->shift);
        }

        $date = $log->work_date?->toDateString();
        $assignment = $assignments->first(
            fn (ShiftAssignment $a) => $a->date?->toDateString() === $date && $a->shift
        );
        if ($assignment?->shift) {
            return $this->shiftMinutes($assignment->shift);
        }

        return 8 * 60;
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
