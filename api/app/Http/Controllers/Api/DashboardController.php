<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Branch;
use App\Models\Employee;
use App\Models\Shift;
use App\Models\ShiftAssignment;
use App\Services\Attendance\AttendanceService;
use App\Services\Leave\LeaveService;
use App\Support\Tenancy\TenantContext;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

class DashboardController extends Controller
{
    public function __construct(
        private readonly AttendanceService $attendance,
        private readonly LeaveService $leaves,
    ) {
    }

    public function shell(Request $request): JsonResponse
    {
        return response()->json($this->chrome($request));
    }

    public function switchCurrentBranch(Request $request): JsonResponse
    {
        $data = $request->validate([
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
        ]);

        $branch = Branch::query()->findOrFail((int) $data['branch_id']);
        $user = $request->user();
        $user->forceFill(['current_branch_id' => $branch->id])->save();

        return response()->json($this->chrome($request));
    }

    public function overview(Request $request): JsonResponse
    {
        $chrome = $this->chrome($request);
        $now = Carbon::now('Asia/Ho_Chi_Minh');
        $today = $now->toDateString();
        $branchId = ((int) ($chrome['branch']['id'] ?? 0)) ?: null;

        $totalEmployees = Employee::query()
            ->where('status', Employee::STATUS_ACTIVE)
            ->when(
                $branchId,
                fn ($q) => $q->whereHas(
                    'branches',
                    fn ($b) => $b->where('branches.id', $branchId)
                )
            )
            ->count();

        $attendance = $this->safeAttendanceSnapshot($today, $branchId);
        $notifications = $this->buildNotifications(
            $totalEmployees,
            $attendance,
            $chrome['branch']['name'] !== 'Chưa có chi nhánh'
                ? preg_replace('/^Chi nhánh /', '', (string) $chrome['branch']['name'])
                : null,
            $chrome['pending_leaves'] ?? [],
        );

        return response()->json([
            ...$chrome,
            'notification_count' => count(array_filter(
                $notifications,
                fn ($n) => ($n['unread'] ?? false) === true,
            )),
            'notifications' => $notifications,
            'kpis' => $this->buildKpis($totalEmployees, $attendance),
            'attendance_today' => $attendance['rows'],
            'salary_projection' => $this->salaryProjection($now, $totalEmployees),
            'personnel_costs' => $this->mockPersonnelCosts($now),
            'performance' => $this->buildPerformance($attendance),
            'upcoming_shifts' => $this->upcomingShifts($today, $branchId),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    protected function chrome(Request $request): array
    {
        $user = $request->user();
        $org = TenantContext::organization() ?? $user?->currentOrganization;

        $branches = Branch::query()
            ->orderByDesc('is_headquarters')
            ->orderBy('name')
            ->get(['id', 'name', 'is_headquarters', 'address']);

        $primaryBranch = $branches->firstWhere('is_headquarters', true) ?? $branches->first();
        $currentBranch = $branches->firstWhere('id', (int) ($user?->current_branch_id ?? 0))
            ?? $primaryBranch;
        $now = Carbon::now('Asia/Ho_Chi_Minh');
        $weekdays = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

        $access = $user
            ? \App\Support\Authorization\EffectivePermission::for($user)
            : null;
        $pendingLeaves = $this->leaves->pendingForDashboard();
        $notifications = $this->shellNotifications($pendingLeaves);

        return [
            'greeting' => [
                'name' => $user?->name ?? 'Admin',
                'message' => 'Chúc bạn một ngày làm việc hiệu quả',
            ],
            'role' => $user?->roleIn($org),
            'role_label' => $access?->roleLabel() ?? 'Thành viên',
            'access' => $access?->payload(),
            'tenant' => [
                'name' => $org?->name ?? '—',
                'branch' => $currentBranch
                    ? ($currentBranch->is_headquarters ? 'Chi nhánh '.$currentBranch->name : $currentBranch->name)
                    : 'Chưa có chi nhánh',
                'avatar' => 'https://i.pravatar.cc/80?u='.urlencode((string) ($org?->slug ?? 'org')),
                'logo_url' => $org?->logoUrl(),
                'has_logo' => filled($org?->logo_path),
            ],
            'branch' => $currentBranch ? [
                'id' => $currentBranch->id,
                'name' => 'Chi nhánh '.$currentBranch->name,
            ] : [
                'id' => 0,
                'name' => 'Chưa có chi nhánh',
            ],
            'branches' => $branches->map(fn (Branch $b) => [
                'id' => $b->id,
                'name' => $b->name,
                'is_headquarters' => $b->is_headquarters,
                'address' => $b->address,
            ])->values()->all(),
            'date' => $weekdays[$now->dayOfWeek].', '.$now->format('d/m/Y'),
            'notification_count' => count(array_filter(
                $notifications,
                fn ($n) => ($n['unread'] ?? false) === true,
            )),
            'pending_leaves' => $pendingLeaves,
            'notifications' => $notifications,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $pendingLeaves
     * @return list<array<string, mixed>>
     */
    protected function shellNotifications(array $pendingLeaves): array
    {
        $items = [];

        foreach ($pendingLeaves as $leave) {
            $from = ! empty($leave['from']) ? Carbon::parse($leave['from'])->format('d/m/Y') : '';
            $to = ! empty($leave['to']) ? Carbon::parse($leave['to'])->format('d/m/Y') : '';
            $dateLabel = ($from && $to && $from !== $to) ? $from.' → '.$to : ($from ?: $to);

            $items[] = [
                'id' => 'leave-'.$leave['id'],
                'type' => 'leave',
                'title' => 'Đơn nghỉ chờ duyệt',
                'message' => ($leave['full_name'] ?? 'Nhân viên').' xin nghỉ phép ngày '.$dateLabel,
                'time' => $leave['time'] ?? 'Vừa xong',
                'unread' => true,
                'leave_id' => $leave['id'],
            ];
        }

        return $items;
    }

    /**
     * @return array{rows: list<array<string, mixed>>, working: int, not_checked_in: int, late: int, absent: int, on_leave: int, ontime: int}
     */
    protected function safeAttendanceSnapshot(string $date, ?int $branchId = null): array
    {
        $empty = [
            'rows' => [],
            'working' => 0,
            'not_checked_in' => 0,
            'late' => 0,
            'absent' => 0,
            'on_leave' => 0,
            'ontime' => 0,
        ];

        try {
            $filters = [
                'date' => $date,
                'per_page' => 50,
                'page' => 1,
            ];
            if ($branchId) {
                $filters['branch_id'] = $branchId;
            }

            $paginator = $this->attendance->list($filters);

            $source = collect($paginator->items());
            $working = $source->where('ui_status', 'working')->count();
            $notCheckedIn = $source->where('ui_status', 'not_checked_in')->count();
            $late = $source->where('check_in_tone', 'late')->count();
            $ontime = $source->filter(
                fn ($r) => in_array($r['check_in_tone'] ?? '', ['early', 'ontime'], true)
            )->count();
            $absent = $source->filter(
                fn ($r) => ($r['ui_status'] ?? '') === 'absent'
            )->count();
            $onLeave = $source->filter(
                fn ($r) => ($r['ui_status'] ?? '') === 'on_leave'
            )->count();

            $rows = $source->take(8)->map(function (array $row) {
                $status = 'pending';
                $statusLabel = 'Chưa check-in';

                if (($row['check_in_tone'] ?? '') === 'late') {
                    $status = 'late';
                    $statusLabel = $row['check_in_label'] ?? 'Đi trễ';
                } elseif (in_array($row['check_in_tone'] ?? '', ['early', 'ontime'], true)) {
                    $status = 'on_time';
                    $statusLabel = $row['check_in_label'] ?? 'Đúng giờ';
                } elseif (($row['ui_status'] ?? '') === 'working') {
                    $status = 'on_time';
                    $statusLabel = 'Đang làm việc';
                } elseif (($row['ui_status'] ?? '') === 'checked_out') {
                    $status = 'on_time';
                    $statusLabel = 'Đã check-out';
                } elseif (($row['ui_status'] ?? '') === 'on_leave') {
                    $status = 'on_leave';
                    $statusLabel = $row['leave_type_label'] ?? 'Nghỉ phép';
                }

                return [
                    'id' => $row['employee_id'],
                    'name' => $row['full_name'],
                    'role' => $row['position'] ?? '—',
                    'avatar' => $row['avatar']
                        ?: null,
                    'shift' => $row['shift_time'] ?? '—',
                    'check_in' => $row['check_in'],
                    'status' => $status,
                    'status_label' => $statusLabel,
                ];
            })->values()->all();

            return [
                'rows' => $rows,
                'working' => $working,
                'not_checked_in' => $notCheckedIn,
                'late' => $late,
                'absent' => $absent,
                'on_leave' => $onLeave,
                'ontime' => $ontime,
            ];
        } catch (Throwable) {
            return $empty;
        }
    }

    /**
     * @param  array{working: int, not_checked_in: int, late: int, absent: int}  $attendance
     * @return list<array<string, mixed>>
     */
    protected function buildKpis(int $totalEmployees, array $attendance): array
    {
        $pct = static function (int $value) use ($totalEmployees): ?float {
            if ($totalEmployees <= 0) {
                return null;
            }

            return round(($value / $totalEmployees) * 100, 1);
        };

        return [
            [
                'key' => 'total',
                'label' => 'Tổng nhân viên',
                'value' => $totalEmployees,
                'percent' => null,
                'color' => 'blue',
            ],
            [
                'key' => 'working',
                'label' => 'Đang làm việc',
                'value' => $attendance['working'],
                'percent' => $pct($attendance['working']),
                'color' => 'green',
            ],
            [
                'key' => 'not_checked_in',
                'label' => 'Chưa check-in',
                'value' => $attendance['not_checked_in'],
                'percent' => $pct($attendance['not_checked_in']),
                'color' => 'orange',
            ],
            [
                'key' => 'late',
                'label' => 'Đi trễ',
                'value' => $attendance['late'],
                'percent' => $pct($attendance['late']),
                'color' => 'red',
            ],
            [
                'key' => 'absent',
                'label' => 'Nghỉ / Vắng',
                'value' => $attendance['absent'],
                'percent' => $pct($attendance['absent']),
                'color' => 'sky',
            ],
        ];
    }

    /**
     * @param  array{working: int, not_checked_in: int, late: int, absent: int, ontime: int}  $attendance
     * @param  list<array<string, mixed>>  $pendingLeaves
     * @return list<array<string, mixed>>
     */
    protected function buildNotifications(int $totalEmployees, array $attendance, ?string $branchName, array $pendingLeaves = []): array
    {
        $items = [];

        foreach ($pendingLeaves as $leave) {
            $from = ! empty($leave['from']) ? Carbon::parse($leave['from'])->format('d/m/Y') : '';
            $to = ! empty($leave['to']) ? Carbon::parse($leave['to'])->format('d/m/Y') : '';
            $dateLabel = ($from && $to && $from !== $to) ? $from.' → '.$to : ($from ?: $to);

            $items[] = [
                'id' => 'leave-'.$leave['id'],
                'type' => 'leave',
                'title' => 'Đơn nghỉ chờ duyệt',
                'message' => ($leave['full_name'] ?? 'Nhân viên').' xin nghỉ phép ngày '.$dateLabel,
                'time' => $leave['time'] ?? 'Vừa xong',
                'unread' => true,
                'leave_id' => $leave['id'],
            ];
        }

        if ($totalEmployees === 0) {
            $items[] = [
                'id' => 'doc-1',
                'type' => 'employee',
                'title' => 'Nhân viên mới',
                'message' => 'Chưa có nhân viên — hãy thêm nhân viên để bắt đầu',
                'time' => 'Vừa xong',
                'unread' => true,
            ];
        } elseif ($attendance['not_checked_in'] > 0) {
            $items[] = [
                'id' => 'warn-in',
                'type' => 'warning',
                'title' => 'Cảnh báo',
                'message' => $attendance['not_checked_in'].' nhân viên chưa check-in hôm nay',
                'time' => 'Hôm nay',
                'unread' => true,
            ];
        }

        if ($attendance['late'] > 0) {
            $items[] = [
                'id' => 'warn-late',
                'type' => 'warning',
                'title' => 'Cảnh báo',
                'message' => $attendance['late'].' nhân viên đi trễ',
                'time' => 'Hôm nay',
                'unread' => true,
            ];
        }

        if ($branchName && $items === []) {
            $items[] = [
                'id' => 'shift-ok',
                'type' => 'shift',
                'title' => 'Ca làm việc',
                'message' => 'Chi nhánh '.$branchName.' đang hoạt động',
                'time' => 'Hôm nay',
                'unread' => false,
            ];
        }

        return $items;
    }

    /**
     * @param  array{working: int, not_checked_in: int, late: int, ontime: int}  $attendance
     */
    protected function buildPerformance(array $attendance): array
    {
        $checked = max(1, $attendance['working'] + $attendance['ontime'] + $attendance['late']);
        $ontimePct = (int) round(($attendance['ontime'] / $checked) * 100);
        $completePct = (int) round((($attendance['working'] + $attendance['ontime'] + $attendance['late']) / max(1, $attendance['working'] + $attendance['not_checked_in'] + $attendance['late'] + $attendance['ontime'])) * 100);

        return [
            'overall' => $ontimePct,
            'metrics' => [
                ['label' => 'Đúng giờ', 'value' => $ontimePct, 'color' => '#22C55E'],
                ['label' => 'Hoàn thành ca', 'value' => $completePct, 'color' => '#6366F1'],
                ['label' => 'Làm thêm', 'value' => 0, 'color' => '#F59E0B'],
                ['label' => 'Nghỉ phép', 'value' => 0, 'color' => '#EF4444'],
            ],
        ];
    }

    /**
     * @return list<array<string, mixed>>
     */
    protected function upcomingShifts(string $fromDate, ?int $branchId = null): array
    {
        try {
            $from = Carbon::parse($fromDate)->startOfDay();
            $to = $from->copy()->addDays(3)->endOfDay();

            $assignments = ShiftAssignment::query()
                ->with('shift')
                ->whereBetween('date', [$from->toDateString(), $to->toDateString()])
                ->where('status', ShiftAssignment::STATUS_ASSIGNED)
                ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
                ->orderBy('date')
                ->get()
                ->groupBy(fn (ShiftAssignment $a) => $a->date->toDateString().'|'.($a->shift_id ?? 0));

            $items = [];
            foreach ($assignments as $group) {
                /** @var ShiftAssignment $first */
                $first = $group->first();
                $shift = $first->shift;
                if (! $shift instanceof Shift) {
                    continue;
                }

                $date = Carbon::parse($first->date);
                $items[] = [
                    'date' => $date->format('d'),
                    'month' => 'Th'.$date->format('m'),
                    'name' => $shift->name,
                    'time' => substr((string) $shift->start_time, 0, 5).' - '.substr((string) $shift->end_time, 0, 5),
                    'employees' => $group->count(),
                ];

                if (count($items) >= 5) {
                    break;
                }
            }

            if ($items !== []) {
                return $items;
            }

            // Fallback: ca đang active trong org
            return Shift::query()
                ->where('status', Shift::STATUS_ACTIVE)
                ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
                ->orderBy('start_time')
                ->limit(3)
                ->get()
                ->map(function (Shift $shift) use ($from) {
                    return [
                        'date' => $from->format('d'),
                        'month' => 'Th'.$from->format('m'),
                        'name' => $shift->name,
                        'time' => substr((string) $shift->start_time, 0, 5).' - '.substr((string) $shift->end_time, 0, 5),
                        'employees' => 0,
                    ];
                })
                ->all();
        } catch (Throwable) {
            return [];
        }
    }

    protected function salaryProjection(Carbon $now, int $employees): array
    {
        return [
            'month' => $now->format('m/Y'),
            'total' => 0,
            'total_formatted' => '0 đ',
            'growth' => 0,
            'employees' => $employees,
            'breakdown' => [
                ['label' => 'Lương cơ bản', 'value' => 0, 'color' => '#6366F1'],
                ['label' => 'Làm thêm giờ', 'value' => 0, 'color' => '#22C55E'],
                ['label' => 'Thưởng', 'value' => 0, 'color' => '#F59E0B'],
                ['label' => 'Phạt', 'value' => 0, 'color' => '#EF4444'],
                ['label' => 'Khác', 'value' => 0, 'color' => '#94A3B8'],
            ],
        ];
    }

    protected function mockPersonnelCosts(Carbon $now): array
    {
        return [
            'month' => $now->format('m/Y'),
            'total' => 0,
            'growth' => 0,
            'days' => collect(range(1, min(15, $now->daysInMonth)))
                ->map(fn ($day) => ['day' => $day, 'value' => 0])
                ->all(),
        ];
    }
}
