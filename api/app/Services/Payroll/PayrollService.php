<?php

namespace App\Services\Payroll;

use App\Models\AttendanceLog;
use App\Models\Employee;
use App\Models\PayrollEntry;
use App\Models\PayrollPayment;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Services\Employee\EmployeeService;
use App\Support\Authorization\PayrollPermission;
use App\Support\Tenancy\TenantContext;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PayrollService
{
    private const DEPT_COLORS = [
        '#8B5CF6',
        '#3B82F6',
        '#F59E0B',
        '#10B981',
        '#F43F5E',
        '#64748B',
    ];

    public function __construct(private readonly EmployeeService $employees)
    {
    }

    /**
     * @return array{from: string, to: string, label: string}
     */
    public function monthBounds(int $year, int $month): array
    {
        $from = Carbon::create($year, $month, 1)->startOfDay();

        return [
            'from' => $from->toDateString(),
            'to' => $from->copy()->endOfMonth()->toDateString(),
            'label' => sprintf('Tháng %02d/%d', $month, $year),
        ];
    }

    public function list(array $filters): array
    {
        PayrollPermission::for()->assertCanViewAny();

        $year = (int) ($filters['year'] ?? now()->year);
        $month = (int) ($filters['month'] ?? now()->month);
        $bounds = $this->monthBounds($year, $month);
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(100, max(1, (int) ($filters['per_page'] ?? 10)));

        $rows = $this->buildRows($year, $month, $filters);
        $stats = $this->computeStats($rows, $year, $month, $filters);
        $departmentsCost = $this->departmentCostBreakdown($rows);

        $total = $rows->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);
        $slice = $rows->slice(($page - 1) * $perPage, $perPage)->values();

        $departments = $rows
            ->pluck('department')
            ->filter(fn ($d) => $d && $d !== 'Chưa phân bổ' && $d !== '—')
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
                'paid' => $rows->where('status', PayrollEntry::STATUS_PAID)->count(),
                'pending' => $rows->where('status', '!=', PayrollEntry::STATUS_PAID)->count(),
            ],
            'departments' => $departments,
            'department_costs' => $departmentsCost,
        ];
    }

    public function dashboard(array $filters): array
    {
        PayrollPermission::for()->assertCanViewAny();

        $year = (int) ($filters['year'] ?? now()->year);
        $month = (int) ($filters['month'] ?? now()->month);
        $rows = $this->buildRows($year, $month, $filters);

        return [
            'stats' => $this->computeStats($rows, $year, $month, $filters),
            'department_costs' => $this->departmentCostBreakdown($rows),
            'summary' => [
                'paid' => $rows->where('status', PayrollEntry::STATUS_PAID)->count(),
                'pending' => $rows->where('status', '!=', PayrollEntry::STATUS_PAID)->count(),
            ],
        ];
    }

    public function generate(array $data): array
    {
        PayrollPermission::for()->assertCanManage();

        $year = (int) $data['year'];
        $month = (int) $data['month'];
        $branchId = ! empty($data['branch_id']) ? (int) $data['branch_id'] : null;

        if ($branchId) {
            PayrollPermission::for()->assertCanAccessBranch($branchId);
        }

        $rows = $this->buildRows($year, $month, array_filter([
            'branch_id' => $branchId,
        ]));

        $created = 0;
        $updated = 0;

        foreach ($rows as $row) {
            $entry = PayrollEntry::query()->firstOrNew([
                'organization_id' => TenantContext::id(),
                'employee_id' => $row['id'],
                'year' => $year,
                'month' => $month,
            ]);

            $wasNew = ! $entry->exists;

            if ($entry->status === PayrollEntry::STATUS_PAID) {
                continue;
            }

            $entry->fill([
                'status' => $entry->status ?: PayrollEntry::STATUS_PENDING,
                'total_minutes' => $row['total_minutes'],
                'income' => $row['income'],
                'deductions' => $row['deductions'],
                'net' => $row['net'],
            ]);
            $entry->save();

            if ($wasNew) {
                $created++;
            } else {
                $updated++;
            }
        }

        return [
            'created' => $created,
            'updated' => $updated,
            'total_employees' => $rows->count(),
            'year' => $year,
            'month' => $month,
        ];
    }

    public function markPaid(array $data): array
    {
        PayrollPermission::for()->assertCanManage();

        $year = (int) $data['year'];
        $month = (int) $data['month'];
        $ids = collect($data['employee_ids'] ?? [])->map(fn ($id) => (int) $id)->unique()->values();
        $status = $data['status'] ?? PayrollEntry::STATUS_PAID;

        if (! in_array($status, [
            PayrollEntry::STATUS_PAID,
            PayrollEntry::STATUS_PENDING,
            PayrollEntry::STATUS_DRAFT,
        ], true)) {
            $status = PayrollEntry::STATUS_PAID;
        }

        $rowsById = $this->buildRows($year, $month, [])->keyBy('id');
        $allowed = $this->scopedEmployees(null)->pluck('id');
        $ids = $ids->filter(fn ($id) => $allowed->contains($id))->values();

        $count = 0;
        foreach ($ids as $employeeId) {
            $computed = $rowsById->get($employeeId);
            $payload = [
                'status' => $status,
                'paid_by' => $status === PayrollEntry::STATUS_PAID ? auth()->id() : null,
                'paid_at' => $status === PayrollEntry::STATUS_PAID ? now() : null,
            ];

            if ($computed) {
                $payload['total_minutes'] = $computed['total_minutes'];
                $payload['income'] = $computed['income'];
                $payload['deductions'] = $computed['deductions'];
                $payload['net'] = $computed['net'];
                if ($status === PayrollEntry::STATUS_PAID) {
                    $payload['paid_amount'] = $computed['net'];
                }
            }

            PayrollEntry::query()->updateOrCreate(
                [
                    'organization_id' => TenantContext::id(),
                    'employee_id' => $employeeId,
                    'year' => $year,
                    'month' => $month,
                ],
                $payload
            );
            $count++;
        }

        return [
            'count' => $count,
            'status' => $status,
            'year' => $year,
            'month' => $month,
        ];
    }

    public function pay(array $data): array
    {
        PayrollPermission::for()->assertCanManage();

        $year = (int) $data['year'];
        $month = (int) $data['month'];
        $employeeId = (int) $data['employee_id'];
        $amount = (int) $data['amount'];
        $method = (string) $data['method'];
        $content = trim((string) ($data['content'] ?? ''));

        $allowed = $this->scopedEmployees(null)->pluck('id');
        if (! $allowed->contains($employeeId)) {
            throw ValidationException::withMessages([
                'employee_id' => ['Bạn không có quyền thanh toán cho nhân viên này.'],
            ]);
        }

        return DB::transaction(function () use ($year, $month, $employeeId, $amount, $method, $content) {
            $computed = $this->buildRows($year, $month, [])->firstWhere('id', $employeeId);
            if (! $computed) {
                throw ValidationException::withMessages([
                    'employee_id' => ['Không tìm thấy nhân viên trong bảng lương.'],
                ]);
            }

            $entry = PayrollEntry::query()->firstOrNew([
                'organization_id' => TenantContext::id(),
                'employee_id' => $employeeId,
                'year' => $year,
                'month' => $month,
            ]);

            if (! $entry->exists || (int) $entry->net === 0) {
                $entry->fill([
                    'status' => PayrollEntry::STATUS_PENDING,
                    'total_minutes' => $computed['total_minutes'],
                    'income' => $computed['income'],
                    'deductions' => $computed['deductions'],
                    'net' => $computed['net'],
                    'paid_amount' => (int) ($entry->paid_amount ?? 0),
                ]);
            }

            $net = (int) $entry->net;
            $paidAmount = (int) $entry->paid_amount;
            $remaining = max(0, $net - $paidAmount);

            if ($remaining <= 0) {
                throw ValidationException::withMessages([
                    'amount' => ['Nhân viên đã được thanh toán đủ lương tháng này.'],
                ]);
            }

            if ($amount > $remaining) {
                throw ValidationException::withMessages([
                    'amount' => ['Số tiền vượt quá số lương còn lại ('.number_format($remaining, 0, ',', '.').'đ).'],
                ]);
            }

            $payment = PayrollPayment::query()->create([
                'organization_id' => TenantContext::id(),
                'payroll_entry_id' => null,
                'employee_id' => $employeeId,
                'year' => $year,
                'month' => $month,
                'amount' => $amount,
                'method' => $method,
                'content' => $content !== '' ? $content : null,
                'paid_by' => auth()->id(),
                'paid_at' => now(),
            ]);

            $newPaid = $paidAmount + $amount;
            $newRemaining = max(0, $net - $newPaid);
            $status = PayrollEntry::STATUS_PENDING;
            if ($newRemaining <= 0) {
                $status = PayrollEntry::STATUS_PAID;
            } elseif ($newPaid > 0) {
                $status = PayrollEntry::STATUS_PARTIAL;
            }

            $entry->fill([
                'paid_amount' => $newPaid,
                'status' => $status,
                'paid_by' => auth()->id(),
                'paid_at' => $status === PayrollEntry::STATUS_PAID ? now() : $entry->paid_at,
            ])->save();

            $payment->forceFill(['payroll_entry_id' => $entry->id])->save();

            return [
                'payment' => [
                    'id' => $payment->id,
                    'employee_id' => $employeeId,
                    'amount' => $amount,
                    'method' => $method,
                    'content' => $payment->content,
                    'paid_at' => $payment->paid_at?->toIso8601String(),
                ],
                'entry' => [
                    'employee_id' => $employeeId,
                    'net' => $net,
                    'paid_amount' => $newPaid,
                    'remaining' => $newRemaining,
                    'status' => $status,
                ],
                'year' => $year,
                'month' => $month,
            ];
        });
    }

    public function paymentHistory(array $filters): array
    {
        PayrollPermission::for()->assertCanViewAny();

        $year = ! empty($filters['year']) ? (int) $filters['year'] : null;
        $month = ! empty($filters['month']) ? (int) $filters['month'] : null;
        $branchId = ! empty($filters['branch_id']) ? (int) $filters['branch_id'] : null;
        $search = mb_strtolower(trim((string) ($filters['search'] ?? '')));
        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(50, max(1, (int) ($filters['per_page'] ?? 20)));

        if ($branchId) {
            PayrollPermission::for()->assertCanAccessBranch($branchId);
        }

        $employeeIds = $this->scopedEmployees($branchId)->pluck('id');

        $payments = PayrollPayment::query()
            ->with(['employee.position', 'payer'])
            ->whereIn('employee_id', $employeeIds)
            ->when($year, fn ($q) => $q->where('year', $year))
            ->when($month, fn ($q) => $q->where('month', $month))
            ->orderByDesc('paid_at')
            ->orderByDesc('id')
            ->get();

        if ($search !== '') {
            $payments = $payments->filter(function (PayrollPayment $p) use ($search) {
                $name = mb_strtolower($p->employee?->full_name ?? '');
                $code = mb_strtolower($p->employee?->employee_code ?? '');
                $content = mb_strtolower((string) $p->content);

                return str_contains($name, $search)
                    || str_contains($code, $search)
                    || str_contains($content, $search);
            })->values();
        }

        $grouped = $payments->groupBy('employee_id')->map(function (Collection $items) {
            /** @var PayrollPayment $first */
            $first = $items->first();
            $employee = $first->employee;

            return [
                'employee_id' => $first->employee_id,
                'employee' => $employee ? $this->employees->payload($employee) : null,
                'department' => $employee?->position?->name ?? '—',
                'payments_count' => $items->count(),
                'total_paid' => (int) $items->sum('amount'),
                'last_paid_at' => $items->first()?->paid_at?->toIso8601String(),
                'payments' => $items->map(fn (PayrollPayment $p) => [
                    'id' => $p->id,
                    'year' => $p->year,
                    'month' => $p->month,
                    'label' => sprintf('Tháng %02d/%d', $p->month, $p->year),
                    'amount' => (int) $p->amount,
                    'method' => $p->method,
                    'content' => $p->content,
                    'paid_by' => $p->payer?->name,
                    'paid_at' => $p->paid_at?->toIso8601String(),
                ])->values()->all(),
            ];
        })->values();

        $total = $grouped->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);
        $slice = $grouped->slice(($page - 1) * $perPage, $perPage)->values();

        return [
            'data' => $slice->all(),
            'meta' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
            ],
        ];
    }

    public function history(array $filters): array
    {
        PayrollPermission::for()->assertCanViewAny();

        $page = max(1, (int) ($filters['page'] ?? 1));
        $perPage = min(50, max(1, (int) ($filters['per_page'] ?? 12)));
        $yearFilter = ! empty($filters['year']) ? (int) $filters['year'] : null;
        $statusFilter = trim((string) ($filters['status'] ?? ''));
        $search = mb_strtolower(trim((string) ($filters['search'] ?? '')));
        $branchId = ! empty($filters['branch_id']) ? (int) $filters['branch_id'] : null;

        if ($branchId) {
            PayrollPermission::for()->assertCanAccessBranch($branchId);
        }

        $employeeIds = $this->scopedEmployees($branchId)->pluck('id');

        $grouped = PayrollEntry::query()
            ->whereIn('employee_id', $employeeIds)
            ->when($yearFilter, fn ($q) => $q->where('year', $yearFilter))
            ->get()
            ->groupBy(fn (PayrollEntry $e) => sprintf('%04d-%02d', $e->year, $e->month));

        $sheets = $grouped->map(function (Collection $entries, string $key) {
            /** @var PayrollEntry $first */
            $first = $entries->first();
            $year = (int) $first->year;
            $month = (int) $first->month;
            $employees = $entries->count();
            $paidCount = $entries->where('status', PayrollEntry::STATUS_PAID)->count();
            $income = (int) $entries->sum('income');
            $deductions = (int) $entries->sum('deductions');
            $fund = (int) $entries->sum('net');

            $sheetStatus = 'pending';
            if ($paidCount >= $employees && $employees > 0) {
                $sheetStatus = 'completed';
            } elseif ($paidCount > 0) {
                $sheetStatus = 'partial';
            }

            $bounds = $this->monthBounds($year, $month);

            return [
                'id' => $key,
                'year' => $year,
                'month' => $month,
                'label' => $bounds['label'],
                'from' => $bounds['from'],
                'to' => $bounds['to'],
                'employees' => $employees,
                'paid_count' => $paidCount,
                'pending_count' => max(0, $employees - $paidCount),
                'income' => $income,
                'deductions' => $deductions,
                'fund' => $fund,
                'status' => $sheetStatus,
                'created_at' => $entries->min('created_at')?->toIso8601String(),
                'last_paid_at' => $entries
                    ->filter(fn (PayrollEntry $e) => $e->paid_at !== null)
                    ->sortByDesc('paid_at')
                    ->first()
                    ?->paid_at
                    ?->toIso8601String(),
            ];
        })
            ->values()
            ->sortByDesc(fn (array $s) => sprintf('%04d-%02d', $s['year'], $s['month']))
            ->values();

        $sheets = $sheets->filter(function (array $sheet) use ($statusFilter, $search) {
            if ($statusFilter !== '' && $sheet['status'] !== $statusFilter) {
                return false;
            }
            if ($search !== '' && ! str_contains(mb_strtolower($sheet['label']), $search)) {
                return false;
            }

            return true;
        })->values();

        $total = $sheets->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);
        $slice = $sheets->slice(($page - 1) * $perPage, $perPage)->values();

        return [
            'data' => $slice->all(),
            'meta' => [
                'current_page' => $page,
                'last_page' => $lastPage,
                'per_page' => $perPage,
                'total' => $total,
            ],
        ];
    }

    public function historyDetail(int $year, int $month, array $filters = []): array
    {
        PayrollPermission::for()->assertCanViewAny();

        $branchId = ! empty($filters['branch_id']) ? (int) $filters['branch_id'] : null;
        if ($branchId) {
            PayrollPermission::for()->assertCanAccessBranch($branchId);
        }

        $employeeIds = $this->scopedEmployees($branchId)->pluck('id');
        $bounds = $this->monthBounds($year, $month);

        $entries = PayrollEntry::query()
            ->with(['employee.position', 'employee.branches', 'payer'])
            ->whereIn('employee_id', $employeeIds)
            ->where('year', $year)
            ->where('month', $month)
            ->orderBy('employee_id')
            ->get();

        $rows = $entries->map(function (PayrollEntry $entry) {
            $employee = $entry->employee;
            if (! $employee) {
                return null;
            }

            return [
                'id' => $entry->id,
                'employee_id' => $employee->id,
                'employee' => $this->employees->payload($employee),
                'department' => $employee->position?->name ?? 'Chưa phân bổ',
                'position' => $employee->position?->name ?? '—',
                'total_minutes' => (int) $entry->total_minutes,
                'income' => (int) $entry->income,
                'deductions' => (int) $entry->deductions,
                'net' => (int) $entry->net,
                'status' => $entry->status,
                'paid_at' => $entry->paid_at?->toIso8601String(),
                'paid_by' => $entry->payer?->name,
                'created_at' => $entry->created_at?->toIso8601String(),
            ];
        })->filter()->values();

        $employees = $rows->count();
        $paidCount = $rows->where('status', PayrollEntry::STATUS_PAID)->count();
        $sheetStatus = 'pending';
        if ($paidCount >= $employees && $employees > 0) {
            $sheetStatus = 'completed';
        } elseif ($paidCount > 0) {
            $sheetStatus = 'partial';
        }

        return [
            'sheet' => [
                'id' => sprintf('%04d-%02d', $year, $month),
                'year' => $year,
                'month' => $month,
                'label' => $bounds['label'],
                'from' => $bounds['from'],
                'to' => $bounds['to'],
                'employees' => $employees,
                'paid_count' => $paidCount,
                'pending_count' => max(0, $employees - $paidCount),
                'income' => (int) $rows->sum('income'),
                'deductions' => (int) $rows->sum('deductions'),
                'fund' => (int) $rows->sum('net'),
                'status' => $sheetStatus,
                'created_at' => $entries->min('created_at')?->toIso8601String(),
                'last_paid_at' => $entries
                    ->filter(fn (PayrollEntry $e) => $e->paid_at !== null)
                    ->sortByDesc('paid_at')
                    ->first()
                    ?->paid_at
                    ?->toIso8601String(),
            ],
            'data' => $rows->all(),
        ];
    }

    public function export(array $filters): StreamedResponse
    {
        PayrollPermission::for()->assertCanViewAny();

        $year = (int) ($filters['year'] ?? now()->year);
        $month = (int) ($filters['month'] ?? now()->month);
        $rows = $this->buildRows($year, $month, $filters);
        $filename = sprintf('payroll-%04d-%02d.csv', $year, $month);

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            fputcsv($out, [
                'Mã NV',
                'Họ tên',
                'Phòng ban',
                'Chức vụ',
                'Giờ làm (phút)',
                'Ngày nghỉ',
                'Nghỉ không lương',
                'Thu nhập',
                'Khấu trừ',
                'Thực nhận',
                'Trạng thái',
            ]);
            foreach ($rows as $row) {
                fputcsv($out, [
                    $row['employee']['employee_code'] ?? '',
                    $row['employee']['full_name'] ?? '',
                    $row['department'],
                    $row['position'],
                    $row['total_minutes'],
                    $row['leave_days'],
                    $row['unpaid_days'],
                    $row['income'],
                    $row['deductions'],
                    $row['net'],
                    match ($row['status']) {
                        'paid' => 'Đã thanh toán',
                        'draft' => 'Nháp',
                        default => 'Chờ thanh toán',
                    },
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
        $department = trim((string) ($filters['department'] ?? ''));
        $status = trim((string) ($filters['status'] ?? ''));
        $search = mb_strtolower(trim((string) ($filters['search'] ?? '')));

        if ($branchId) {
            PayrollPermission::for()->assertCanAccessBranch($branchId);
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

        $entries = PayrollEntry::query()
            ->whereIn('employee_id', $employeeIds)
            ->where('year', $year)
            ->where('month', $month)
            ->get()
            ->keyBy('employee_id');

        $rows = $employees->map(function (Employee $employee) use ($logs, $assignments, $entries) {
            /** @var Collection<int, AttendanceLog> $empLogs */
            $empLogs = $logs->get($employee->id, collect());
            /** @var Collection<int, ShiftAssignment> $empAssignments */
            $empAssignments = $assignments->get($employee->id, collect());
            $entry = $entries->get($employee->id);

            $leaveLogs = $empLogs->filter(fn (AttendanceLog $log) => $log->isLeave());
            $paidLeaveLogs = $leaveLogs->filter(fn (AttendanceLog $log) => $log->isPaidLeave());
            $unpaidLeaveLogs = $leaveLogs->filter(fn (AttendanceLog $log) => ! $log->isPaidLeave());
            $leaveDays = $leaveLogs->count();
            $paidLeaveDays = $paidLeaveLogs->count();
            $unpaidDays = $unpaidLeaveLogs->count();

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
            foreach ($workedLogs as $log) {
                $mins = $log->total_minutes;
                if ($mins === null && $log->check_in_at && $log->check_out_at) {
                    $mins = max(0, $log->check_in_at->diffInMinutes($log->check_out_at) - (int) $log->break_minutes);
                }
                $workedMinutes += (int) ($mins ?? 0);
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
            if ($workedLogs->isEmpty() && $leaveDays === 0) {
                foreach ($empAssignments as $assignment) {
                    if ($assignment->shift) {
                        $assignmentMinutes += $this->shiftMinutes($assignment->shift);
                    }
                }
            }

            $totalMinutes = $workedMinutes + $paidLeaveMinutes;
            if ($assignmentMinutes > 0) {
                $totalMinutes = $assignmentMinutes;
            }

            $frozen = $entry && in_array($entry->status, [
                PayrollEntry::STATUS_PAID,
                PayrollEntry::STATUS_PARTIAL,
            ], true);

            if ($frozen && (int) $entry->net > 0) {
                $income = (int) $entry->income;
                $deductions = (int) $entry->deductions;
                $net = (int) $entry->net;
                if ((int) $entry->total_minutes > 0) {
                    $totalMinutes = (int) $entry->total_minutes;
                }
            } else {
                $incomeMinutes = $workedMinutes + $paidLeaveMinutes;
                if ($employee->salary_type !== 'hourly') {
                    $incomeMinutes += $unpaidLeaveMinutes;
                }
                if ($assignmentMinutes > 0) {
                    $incomeMinutes = $assignmentMinutes;
                }

                $income = $this->incomeFromHours($employee, $incomeMinutes, $leaveDays > 0);
                $dailyRate = $this->dailyRate($employee);
                $deductions = $unpaidDays * $dailyRate;

                if ($workedMinutes <= 0 && $paidLeaveMinutes <= 0 && $unpaidDays > 0) {
                    $income = 0;
                    $net = 0;
                } else {
                    $net = max(0, $income - $deductions);
                }
            }

            $paidAmount = (int) ($entry?->paid_amount ?? 0);
            $remaining = max(0, $net - $paidAmount);
            $rowStatus = $entry?->status ?? PayrollEntry::STATUS_PENDING;
            if ($remaining <= 0 && $net > 0) {
                $rowStatus = PayrollEntry::STATUS_PAID;
            } elseif ($paidAmount > 0 && $remaining > 0) {
                $rowStatus = PayrollEntry::STATUS_PARTIAL;
            }

            $dept = $employee->position?->name ?? 'Chưa phân bổ';

            return [
                'id' => $employee->id,
                'employee' => $this->employees->payload($employee),
                'department' => $dept,
                'position' => $employee->position?->name ?? '—',
                'total_minutes' => $totalMinutes,
                'leave_days' => $leaveDays,
                'paid_leave_days' => $paidLeaveDays,
                'unpaid_days' => $unpaidDays,
                'income' => $income,
                'deductions' => $deductions,
                'net' => $net,
                'paid_amount' => $paidAmount,
                'remaining' => $remaining,
                'status' => $rowStatus,
                'branch_ids' => $employee->branches->pluck('id')->values()->all(),
                'paid_at' => $entry?->paid_at?->toIso8601String(),
            ];
        });

        return $rows
            ->filter(function (array $row) use ($department, $status, $search) {
                if ($department !== '' && $row['department'] !== $department) {
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
        $income = (int) $rows->sum('income');
        $deductions = (int) $rows->sum('deductions');
        $fund = (int) $rows->sum('net');
        $paid = $rows->where('status', PayrollEntry::STATUS_PAID)->count();

        $prev = Carbon::create($year, $month, 1)->subMonth();
        $prevRows = $this->buildRows((int) $prev->year, (int) $prev->month, $filters);
        $prevIncome = (int) $prevRows->sum('income');
        $prevDeductions = (int) $prevRows->sum('deductions');
        $prevFund = (int) $prevRows->sum('net');

        return [
            'employees' => $employees,
            'fund' => $fund,
            'income' => $income,
            'deductions' => $deductions,
            'paid_percent' => $employees > 0 ? round(($paid / $employees) * 100, 1) : 0,
            'fund_delta' => $this->percentDelta($fund, $prevFund),
            'income_delta' => $this->percentDelta($income, $prevIncome),
            'deductions_delta' => $this->percentDelta($deductions, $prevDeductions),
        ];
    }

    protected function departmentCostBreakdown(Collection $rows): array
    {
        $map = [];
        foreach ($rows as $row) {
            $name = $row['department'];
            $map[$name] = ($map[$name] ?? 0) + (int) $row['net'];
        }

        $items = [];
        $i = 0;
        foreach ($map as $name => $value) {
            $items[] = [
                'name' => $name,
                'value' => $value,
                'color' => self::DEPT_COLORS[$i % count(self::DEPT_COLORS)],
            ];
            $i++;
        }

        usort($items, fn ($a, $b) => $b['value'] <=> $a['value']);

        return $items;
    }

    protected function percentDelta(int $current, int $previous): float
    {
        if ($previous <= 0) {
            return $current > 0 ? 100.0 : 0.0;
        }

        return round((($current - $previous) / $previous) * 100, 1);
    }

    protected function incomeFromHours(Employee $employee, int $minutes, bool $hasLeave = false): int
    {
        $hours = $minutes / 60;
        $amount = (float) $employee->salary_amount;

        if ($employee->salary_type === 'hourly') {
            return (int) round($amount * $hours);
        }

        $monthly = $amount;
        if ($minutes <= 0) {
            return $hasLeave ? 0 : (int) round($monthly * 0.5);
        }

        return (int) round(min($monthly * 1.2, ($monthly / 176) * $hours));
    }

    protected function dailyRate(Employee $employee): int
    {
        $amount = (float) $employee->salary_amount;
        if ($employee->salary_type === 'hourly') {
            return (int) round($amount * 8);
        }

        return (int) round($amount / 26);
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

    /**
     * @return Collection<int, Employee>
     */
    protected function scopedEmployees(?int $branchId): Collection
    {
        $permission = PayrollPermission::for();

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
