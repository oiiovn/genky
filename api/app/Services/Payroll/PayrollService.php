<?php

namespace App\Services\Payroll;

use App\Models\Employee;
use App\Models\MonthlyWorkSummary;
use App\Models\PayrollEntry;
use App\Models\PayrollPayment;
use App\Services\Employee\EmployeeService;
use App\Services\Work\MonthlyWorkSummaryService;
use App\Support\Authorization\PayrollPermission;
use App\Support\Tenancy\TenantContext;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
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

    /** @var array<string, true> */
    private array $freshMonths = [];

    public function __construct(
        private readonly EmployeeService $employees,
        private readonly MonthlyWorkSummaryService $monthly,
    ) {}

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

        $this->ensureMonth($year, $month);
        $filtered = $this->filteredPayrollQuery($year, $month, $filters);
        $total = (int) (clone $filtered)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);

        $ids = (clone $filtered)
            ->join('employees as emp_sort', 'emp_sort.id', '=', 'pr.employee_id')
            ->orderBy('emp_sort.full_name')
            ->orderBy('pr.employee_id')
            ->forPage($page, $perPage)
            ->pluck('pr.employee_id');

        $branchId = ! empty($filters['branch_id']) ? (int) $filters['branch_id'] : null;
        $rows = $this->hydrateByIds($ids, $year, $month, $branchId);
        $current = $this->aggregateMonth($year, $month, $filters);
        $prev = Carbon::create($year, $month, 1)->subMonth();
        $departmentCosts = $this->departmentCostBreakdown($year, $month, $filters);

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
            'stats' => $this->statsFromAggregates(
                $current,
                $this->aggregateMonth((int) $prev->year, (int) $prev->month, $filters),
            ),
            'summary' => [
                'paid' => $current['paid'],
                'pending' => $current['pending'],
            ],
            'departments' => collect($departmentCosts)
                ->pluck('name')
                ->filter(fn ($name) => $name !== '' && $name !== 'Chưa phân bổ' && $name !== '—')
                ->sort()
                ->values()
                ->all(),
            'department_costs' => $departmentCosts,
        ];
    }

    public function dashboard(array $filters): array
    {
        PayrollPermission::for()->assertCanViewAny();

        $year = (int) ($filters['year'] ?? now()->year);
        $month = (int) ($filters['month'] ?? now()->month);
        $current = $this->aggregateMonth($year, $month, $filters);
        $prev = Carbon::create($year, $month, 1)->subMonth();

        return [
            'stats' => $this->statsFromAggregates(
                $current,
                $this->aggregateMonth((int) $prev->year, (int) $prev->month, $filters),
            ),
            'department_costs' => $this->departmentCostBreakdown($year, $month, $filters),
            'summary' => [
                'paid' => $current['paid'],
                'pending' => $current['pending'],
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

        $employees = $this->scopedEmployees($branchId);
        $rows = $this->hydrateMany($employees, $year, $month, $branchId);

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

        $allowed = $this->scopedEmployeeQuery(null)->pluck('employees.id');
        $ids = $ids->filter(fn ($id) => $allowed->contains($id))->values();
        $employees = Employee::query()
            ->with(['position', 'role', 'branches'])
            ->whereIn('id', $ids)
            ->get();
        $rowsById = $this->hydrateMany($employees, $year, $month, null)->keyBy('id');

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

        if (! $this->scopedEmployeeQuery(null)->where('employees.id', $employeeId)->exists()) {
            throw ValidationException::withMessages([
                'employee_id' => ['Bạn không có quyền thanh toán cho nhân viên này.'],
            ]);
        }

        return DB::transaction(function () use ($year, $month, $employeeId, $amount, $method, $content) {
            $employee = Employee::query()
                ->with(['position', 'role', 'branches'])
                ->find($employeeId);
            $computed = $employee
                ? $this->hydrateMany(collect([$employee]), $year, $month, null)->first()
                : null;
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

            if (! $entry->exists || $entry->status !== PayrollEntry::STATUS_PAID) {
                $entry->fill([
                    'status' => $entry->status ?: PayrollEntry::STATUS_PENDING,
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
        $this->ensureMonth($year, $month);
        $branchId = ! empty($filters['branch_id']) ? (int) $filters['branch_id'] : null;
        $ids = $this->filteredPayrollQuery($year, $month, $filters)
            ->join('employees as emp_sort', 'emp_sort.id', '=', 'pr.employee_id')
            ->orderBy('emp_sort.full_name')
            ->orderBy('pr.employee_id')
            ->pluck('pr.employee_id');

        return $this->hydrateByIds($ids, $year, $month, $branchId);
    }

    /**
     * @return list<string>
     */
    protected function departmentOptions(int $year, int $month, array $filters): array
    {
        return $this->filteredPayrollQuery($year, $month, $filters)
            ->whereNotIn('department', ['Chưa phân bổ', '—'])
            ->distinct()
            ->orderBy('department')
            ->pluck('department')
            ->values()
            ->all();
    }

    /**
     * @param  Collection<int, int|string>  $ids
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

        return $this->hydrateMany(
            $ids->map(fn (int $id) => $employees->get($id))->filter()->values(),
            $year,
            $month,
            $branchId,
            $ids,
        );
    }

    /**
     * @param  Collection<int, Employee>  $employees
     * @param  Collection<int, int>|null  $orderedIds
     * @return Collection<int, array<string, mixed>>
     */
    protected function hydrateMany(
        Collection $employees,
        int $year,
        int $month,
        ?int $branchId,
        ?Collection $orderedIds = null,
    ): Collection {
        $this->ensureMonth($year, $month);
        $ids = $employees->pluck('id')->map(fn ($id) => (int) $id)->values();
        if ($ids->isEmpty()) {
            return collect();
        }

        $summaries = MonthlyWorkSummary::query()
            ->where('year', $year)
            ->where('month', $month)
            ->where('branch_id', $branchId ?: 0)
            ->whereIn('employee_id', $ids)
            ->get()
            ->keyBy('employee_id');

        $entries = PayrollEntry::query()
            ->whereIn('employee_id', $ids)
            ->where('year', $year)
            ->where('month', $month)
            ->get()
            ->keyBy('employee_id');

        $rows = $employees->map(function (Employee $employee) use ($summaries, $entries) {
            return $this->hydrateRow(
                $employee,
                $summaries->get($employee->id),
                $entries->get($employee->id),
            );
        })->keyBy('id');

        $order = $orderedIds ?? $ids;

        return $order->map(fn ($id) => $rows->get((int) $id))->filter()->values();
    }

    /**
     * @param  array{employees: int, income: int, deductions: int, fund: int, paid: int, pending: int}  $current
     * @param  array{employees: int, income: int, deductions: int, fund: int, paid: int, pending: int}  $previous
     * @return array<string, float|int>
     */
    protected function statsFromAggregates(array $current, array $previous): array
    {
        return [
            'employees' => $current['employees'],
            'fund' => $current['fund'],
            'income' => $current['income'],
            'deductions' => $current['deductions'],
            'paid_percent' => $current['employees'] > 0
                ? round(($current['paid'] / $current['employees']) * 100, 1)
                : 0,
            'fund_delta' => $this->percentDelta($current['fund'], $previous['fund']),
            'income_delta' => $this->percentDelta($current['income'], $previous['income']),
            'deductions_delta' => $this->percentDelta($current['deductions'], $previous['deductions']),
        ];
    }

    protected function computeStats(int $year, int $month, array $filters): array
    {
        $current = $this->aggregateMonth($year, $month, $filters);
        $prev = Carbon::create($year, $month, 1)->subMonth();

        return $this->statsFromAggregates(
            $current,
            $this->aggregateMonth((int) $prev->year, (int) $prev->month, $filters),
        );
    }

    /**
     * @return array{employees: int, income: int, deductions: int, fund: int, paid: int, pending: int}
     */
    protected function aggregateMonth(int $year, int $month, array $filters): array
    {
        $row = $this->filteredPayrollQuery($year, $month, $filters)
            ->selectRaw('count(*) as employees')
            ->selectRaw('coalesce(sum(income), 0) as income')
            ->selectRaw('coalesce(sum(deductions), 0) as deductions')
            ->selectRaw('coalesce(sum(net), 0) as fund')
            ->selectRaw("coalesce(sum(case when row_status = 'paid' then 1 else 0 end), 0) as paid")
            ->first();

        $employees = (int) ($row->employees ?? 0);
        $paid = (int) ($row->paid ?? 0);

        return [
            'employees' => $employees,
            'income' => (int) round((float) ($row->income ?? 0)),
            'deductions' => (int) round((float) ($row->deductions ?? 0)),
            'fund' => (int) round((float) ($row->fund ?? 0)),
            'paid' => $paid,
            'pending' => max(0, $employees - $paid),
        ];
    }

    /**
     * @return array{paid: int, pending: int}
     */
    protected function aggregateSummary(int $year, int $month, array $filters): array
    {
        $agg = $this->aggregateMonth($year, $month, $filters);

        return [
            'paid' => $agg['paid'],
            'pending' => $agg['pending'],
        ];
    }

    protected function departmentCostBreakdown(int $year, int $month, array $filters): array
    {
        $rows = $this->filteredPayrollQuery($year, $month, $filters)
            ->selectRaw('department')
            ->selectRaw('coalesce(sum(net), 0) as value')
            ->groupBy('department')
            ->orderByDesc('value')
            ->get();

        $items = [];
        $i = 0;
        foreach ($rows as $row) {
            $items[] = [
                'name' => (string) $row->department,
                'value' => (int) round((float) $row->value),
                'color' => self::DEPT_COLORS[$i % count(self::DEPT_COLORS)],
            ];
            $i++;
        }

        return $items;
    }

    protected function payrollComputedQuery(int $year, int $month, array $filters): Builder
    {
        $this->ensureMonth($year, $month);

        $branchId = ! empty($filters['branch_id']) ? (int) $filters['branch_id'] : null;
        if ($branchId) {
            PayrollPermission::for()->assertCanAccessBranch($branchId);
        }

        $department = trim((string) ($filters['department'] ?? ''));
        $search = trim((string) ($filters['search'] ?? ''));
        $orgId = TenantContext::id();

        // Income minutes = phút chấm công thực tế. Không cộng hệ số OT / giờ làm thêm.
        $worked = 'coalesce(mws.payroll_worked_minutes, 0)';
        $unpaidDays = 'coalesce(mws.payroll_unpaid_days, 0)';
        $amount = 'coalesce(employees.salary_amount, 0)';
        $incomeMinutes = $worked;
        $hours = "({$incomeMinutes}) / 60.0";
        $monthlyCap = "{$amount} * 1.2";
        $hourlyFromMonthly = "({$amount} / 176.0) * ({$hours})";
        $cappedMonthly = "case when {$monthlyCap} < {$hourlyFromMonthly} then {$monthlyCap} else {$hourlyFromMonthly} end";
        $hourlyIncome = "round(({$amount} * 1.0 * ({$incomeMinutes})) / 60.0)";
        $rawIncome = "case when ({$incomeMinutes}) <= 0 then 0 when employees.salary_type = 'hourly' then {$hourlyIncome} else {$cappedMonthly} end";
        $dailyRate = "case when employees.salary_type = 'hourly' then round(({$amount} * 480.0) / 60.0) else {$amount} / 26.0 end";
        $rawDeductions = "({$unpaidDays}) * ({$dailyRate})";
        $frozen = "pe.status = 'paid' and coalesce(pe.net, 0) > 0";
        $income = "case when {$frozen} then pe.income else {$rawIncome} end";
        $deductions = "case when {$frozen} then pe.deductions else {$rawDeductions} end";
        $net = "case when {$frozen} then pe.net else case when ({$rawIncome}) - ({$rawDeductions}) > 0 then ({$rawIncome}) - ({$rawDeductions}) else 0 end end";
        $paidAmount = 'coalesce(pe.paid_amount, 0)';
        $remaining = "case when ({$net}) - ({$paidAmount}) > 0 then ({$net}) - ({$paidAmount}) else 0 end";
        $rowStatus = "case when ({$remaining}) <= 0 and ({$net}) > 0 then 'paid' when ({$paidAmount}) > 0 and ({$remaining}) > 0 then 'partial' else coalesce(pe.status, 'pending') end";

        $query = $this->scopedEmployeeQuery($branchId)
            ->leftJoin('monthly_work_summaries as mws', function ($join) use ($year, $month, $branchId, $orgId) {
                $join->on('mws.employee_id', '=', 'employees.id')
                    ->where('mws.year', '=', $year)
                    ->where('mws.month', '=', $month)
                    ->where('mws.branch_id', '=', $branchId ?: 0);
                if ($orgId) {
                    $join->where('mws.organization_id', '=', $orgId);
                }
            })
            ->leftJoin('payroll_entries as pe', function ($join) use ($year, $month, $orgId) {
                $join->on('pe.employee_id', '=', 'employees.id')
                    ->where('pe.year', '=', $year)
                    ->where('pe.month', '=', $month);
                if ($orgId) {
                    $join->where('pe.organization_id', '=', $orgId);
                }
            })
            ->leftJoin('positions as pos', 'pos.id', '=', 'employees.position_id')
            ->selectRaw('employees.id as employee_id')
            ->selectRaw('coalesce(pos.name, ?) as department', ['Chưa phân bổ'])
            ->selectRaw("({$income}) as income")
            ->selectRaw("({$deductions}) as deductions")
            ->selectRaw("({$net}) as net")
            ->selectRaw("({$rowStatus}) as row_status");

        if ($department !== '') {
            if ($department === 'Chưa phân bổ') {
                $query->whereNull('pos.id');
            } else {
                $query->where('pos.name', $department);
            }
        }

        if ($search !== '') {
            $like = '%'.addcslashes($search, '%_\\').'%';
            $query->where(function (Builder $inner) use ($like) {
                $inner->where('employees.full_name', 'like', $like)
                    ->orWhere('employees.employee_code', 'like', $like)
                    ->orWhere('pos.name', 'like', $like);
            });
        }

        return $query;
    }

    protected function filteredPayrollQuery(int $year, int $month, array $filters)
    {
        $query = DB::query()->fromSub(
            $this->payrollComputedQuery($year, $month, $filters)->toBase(),
            'pr'
        );

        $status = trim((string) ($filters['status'] ?? ''));
        if ($status !== '') {
            $query->where('row_status', $status);
        }

        return $query;
    }

    protected function percentDelta(int $current, int $previous): float
    {
        if ($previous <= 0) {
            return $current > 0 ? 100.0 : 0.0;
        }

        return round((($current - $previous) / $previous) * 100, 1);
    }

    protected function hydrateRow(
        Employee $employee,
        ?MonthlyWorkSummary $summary,
        ?PayrollEntry $entry,
    ): array {
        $workedMinutes = (int) ($summary?->payroll_worked_minutes ?? 0);
        $leaveDays = (int) ($summary?->payroll_leave_days ?? 0);
        $paidLeaveDays = (int) ($summary?->payroll_paid_leave_days ?? 0);
        $unpaidDays = (int) ($summary?->payroll_unpaid_days ?? 0);
        // Payroll actual minutes = attendance only (leave/assignment never count as income time).
        $totalMinutes = $workedMinutes;

        $frozen = $entry && $entry->status === PayrollEntry::STATUS_PAID;

        if ($frozen && (int) $entry->net > 0) {
            $income = (int) $entry->income;
            $deductions = (int) $entry->deductions;
            $net = (int) $entry->net;
            if ((int) $entry->total_minutes > 0) {
                $totalMinutes = (int) $entry->total_minutes;
            }
        } else {
            $income = $this->incomeFromHours($employee, $workedMinutes);
            $dailyRate = $this->dailyRate($employee);
            $deductions = $unpaidDays * $dailyRate;
            $net = max(0, $income - $deductions);
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
    }

    protected function incomeFromHours(Employee $employee, int $minutes): int
    {
        $amount = (float) $employee->salary_amount;

        if ($minutes <= 0) {
            return 0;
        }

        if ($employee->salary_type === 'hourly') {
            // Đơn giá/phút × tổng phút làm. Không nhân OT.
            return (int) round(($amount * $minutes) / 60);
        }

        $hours = $minutes / 60;

        return (int) round(min($amount * 1.2, ($amount / 176) * $hours));
    }

    protected function dailyRate(Employee $employee): int
    {
        $amount = (float) $employee->salary_amount;
        if ($employee->salary_type === 'hourly') {
            return (int) round(($amount * 480) / 60);
        }

        return (int) round($amount / 26);
    }

    /**
     * @return Collection<int, Employee>
     */
    protected function scopedEmployees(?int $branchId): Collection
    {
        return $this->scopedEmployeeQuery($branchId)
            ->with(['position', 'role', 'branches'])
            ->orderBy('employees.full_name')
            ->get();
    }

    protected function scopedEmployeeQuery(?int $branchId): Builder
    {
        $permission = PayrollPermission::for();

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
