<?php

namespace Tests\Feature\Timesheet;

use App\Models\AttendanceLog;
use App\Models\Employee;
use App\Models\MonthlyWorkSummary;
use App\Models\TimesheetApproval;
use App\Models\User;
use App\Services\Employee\EmployeeService;
use App\Services\Timesheet\TimesheetService;
use App\Services\Work\MonthlyWorkSummaryService;
use App\Support\Tenancy\TenantContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class TimesheetModuleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, branch_id: int, org_id: int}
     */
    protected function seedOwnerWithBranch(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-ts@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH TS',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH TS',
            'phone' => '0901111111',
            'address' => 'Gò Vấp',
        ]);
        $this->app['auth']->forgetGuards();

        $branch = $this->withToken($token)->postJson('/api/onboarding/branch', [
            'name' => 'Lê Văn Quới',
            'address' => '123 Lê Văn Quới',
            'check_in_radius_meters' => 100,
        ])->json('branch');
        $this->app['auth']->forgetGuards();

        return [
            'token' => $token,
            'branch_id' => $branch['id'],
            'org_id' => $register['organization']['id'],
        ];
    }

    public function test_list_generate_and_approve_timesheet(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Nhi',
            'email' => 'nhi-ts@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'monthly',
            'salary_amount' => 8000000,
        ])->assertCreated()->json('data');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => now()->toDateString(),
            'check_in_time' => '08:00',
            'location_label' => 'Quầy',
        ])->assertCreated();

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/attendances/check-out', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => now()->toDateString(),
            'check_out_time' => '17:00',
        ])->assertOk();

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->postJson('/api/timesheets/generate', [
                'year' => $year,
                'month' => $month,
            ])
            ->assertOk()
            ->assertJsonPath('data.total_employees', 1);

        $this->app['auth']->forgetGuards();

        $list = $this->withToken($ctx['token'])
            ->getJson("/api/timesheets?year={$year}&month={$month}")
            ->assertOk()
            ->json();

        $this->assertGreaterThanOrEqual(1, $list['meta']['total']);
        $row = collect($list['data'])->firstWhere('id', $employee['id']);
        $this->assertNotNull($row);
        $this->assertSame('pending', $row['status']);
        $this->assertGreaterThan(0, $row['work_days']);
        $this->assertDatabaseHas('monthly_work_summaries', [
            'employee_id' => $employee['id'],
            'year' => $year,
            'month' => $month,
            'branch_id' => 0,
        ]);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->postJson('/api/timesheets/approve', [
                'year' => $year,
                'month' => $month,
                'employee_ids' => [$employee['id']],
                'status' => 'approved',
            ])
            ->assertOk()
            ->assertJsonPath('data.count', 1);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson("/api/timesheets?year={$year}&month={$month}&status=approved")
            ->assertOk()
            ->assertJsonPath('summary.approved', 1);

        $this->assertDatabaseHas('attendance_logs', [
            'employee_id' => $employee['id'],
            'status' => AttendanceLog::STATUS_CHECKED_OUT,
        ]);

        $this->app['auth']->forgetGuards();
        $dashboard = $this->withToken($ctx['token'])
            ->getJson("/api/timesheets/dashboard?year={$year}&month={$month}")
            ->assertOk()
            ->json('data');

        $this->assertSame($list['stats']['employees'], $dashboard['employees']);
        $this->assertSame($list['stats']['work_minutes'], $dashboard['work_minutes']);
        $this->assertSame($list['stats']['estimated_cost'], $dashboard['estimated_cost']);
        $this->assertGreaterThan(0, $dashboard['work_minutes']);
    }

    public function test_list_paginates_on_sql_without_hydrating_all_rows(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;

        for ($i = 1; $i <= 12; $i++) {
            $this->app['auth']->forgetGuards();
            $this->withToken($ctx['token'])->postJson('/api/employees', [
                'full_name' => sprintf('Nhân viên %02d', $i),
                'email' => "ts-page-{$i}@fresh.test",
                'branch_ids' => [$ctx['branch_id']],
                'salary_type' => 'monthly',
                'salary_amount' => 5000000,
            ])->assertCreated();
        }

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])
            ->getJson("/api/timesheets?year={$year}&month={$month}&per_page=10")
            ->assertOk();

        $this->app['auth']->forgetGuards();
        $page1 = $this->withToken($ctx['token'])
            ->getJson("/api/timesheets?year={$year}&month={$month}&per_page=10&page=1")
            ->assertOk()
            ->json();

        $this->assertSame(12, $page1['meta']['total']);
        $this->assertSame(2, $page1['meta']['last_page']);
        $this->assertCount(10, $page1['data']);
        $this->assertSame($page1['stats']['employees'], $page1['meta']['total']);

        $this->app['auth']->forgetGuards();
        $page2 = $this->withToken($ctx['token'])
            ->getJson("/api/timesheets?year={$year}&month={$month}&per_page=10&page=2")
            ->assertOk()
            ->json();

        $this->assertCount(2, $page2['data']);
        $ids = collect($page1['data'])->pluck('id')->merge(collect($page2['data'])->pluck('id'));
        $this->assertCount(12, $ids->unique());

        $this->app['auth']->forgetGuards();
        $search = $this->withToken($ctx['token'])
            ->getJson("/api/timesheets?year={$year}&month={$month}&search=".urlencode('Nhân viên 01'))
            ->assertOk()
            ->json();
        $this->assertSame(1, $search['meta']['total']);
        $this->assertSame('Nhân viên 01', $search['data'][0]['employee']['full_name']);
    }

    public function test_warmed_list_beats_full_org_hydration(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;
        $this->seedManyEmployees($ctx['org_id'], $ctx['branch_id'], 40, 'TS');

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])
            ->getJson("/api/timesheets?year={$year}&month={$month}&per_page=10")
            ->assertOk();

        $user = User::query()->where('email', 'owner-ts@fresh.test')->firstOrFail();
        $this->actingAs($user, 'sanctum');
        TenantContext::fromUser($user);

        $before = $this->measureList(function () use ($year, $month) {
            $employees = Employee::query()
                ->where('employees.status', Employee::STATUS_ACTIVE)
                ->with(['position', 'branches'])
                ->orderBy('employees.full_name')
                ->get();
            $summaries = app(MonthlyWorkSummaryService::class)->forMonth($year, $month, null);
            $approvals = TimesheetApproval::query()
                ->whereIn('employee_id', $employees->pluck('id'))
                ->where('year', $year)
                ->where('month', $month)
                ->get()
                ->keyBy('employee_id');
            $payload = app(EmployeeService::class);
            $rows = $employees->map(function (Employee $employee) use ($summaries, $approvals, $payload) {
                $employee->loadMissing(['position', 'role', 'branches']);

                return [
                    'id' => $employee->id,
                    'employee' => $payload->payload($employee),
                    'department' => $employee->position?->name ?? '—',
                    'status' => $approvals->get($employee->id)?->status ?? TimesheetApproval::STATUS_PENDING,
                ];
            });

            return [
                'data' => $rows->slice(0, 10)->values(),
                'hydrated' => $employees->count(),
            ];
        });

        $after = $this->measureList(function () use ($year, $month) {
            return app(TimesheetService::class)->list([
                'year' => $year,
                'month' => $month,
                'per_page' => 10,
                'page' => 1,
            ]);
        });

        $this->assertCount(10, $after['result']['data']);
        $this->assertSame(40, $after['result']['meta']['total']);
        $this->assertSame(40, $before['result']['hydrated']);
        $this->assertLessThanOrEqual(10, $after['employee_rows']);
        $this->assertLessThanOrEqual(10, $after['summaries']);
        $this->assertLessThan($before['result']['hydrated'], $after['employee_rows']);

        fwrite(STDERR, sprintf(
            "\nTimesheet list (40 employees, page=10, warmed)\n".
            "          queries  emp_rows  summary_rows  approval_rows  memory    time\n".
            "before    %-8d %-9d %-13d %-14d %-9s %.1fms\n".
            "after     %-8d %-9d %-13d %-14d %-9s %.1fms\n",
            $before['queries'],
            $before['result']['hydrated'],
            $before['summaries'],
            $before['approvals'],
            $this->formatBytes($before['memory']),
            $before['ms'],
            $after['queries'],
            $after['employee_rows'],
            $after['summaries'],
            $after['approvals'],
            $this->formatBytes($after['memory']),
            $after['ms'],
        ));
    }

    /**
     * @param  callable(): mixed  $callback
     * @return array{queries: int, employee_rows: int, summaries: int, approvals: int, memory: int, ms: float, result: mixed}
     */
    protected function measureList(callable $callback): array
    {
        $summaries = 0;
        $approvals = 0;
        $active = true;
        MonthlyWorkSummary::retrieved(static function () use (&$summaries, &$active) {
            if ($active) {
                $summaries++;
            }
        });
        TimesheetApproval::retrieved(static function () use (&$approvals, &$active) {
            if ($active) {
                $approvals++;
            }
        });

        gc_collect_cycles();
        DB::flushQueryLog();
        DB::enableQueryLog();
        $memory = memory_get_usage();
        $started = hrtime(true);
        $result = $callback();
        $ms = (hrtime(true) - $started) / 1e6;
        $log = DB::getQueryLog();
        $queries = count($log);
        DB::disableQueryLog();
        $active = false;

        return [
            'queries' => $queries,
            'employee_rows' => $this->countWhereInRows($log, 'employees'),
            'summaries' => $summaries,
            'approvals' => $approvals,
            'memory' => max(0, memory_get_usage() - $memory),
            'ms' => $ms,
            'result' => $result,
        ];
    }

    /**
     * @param  list<array<string, mixed>>  $log
     */
    protected function countWhereInRows(array $log, string $table): int
    {
        $total = 0;
        foreach ($log as $item) {
            $sql = strtolower((string) ($item['query'] ?? $item['sql'] ?? ''));
            if (! str_contains($sql, 'from "'.$table.'"') && ! str_contains($sql, 'from '.$table)) {
                continue;
            }
            if (! preg_match('/"id" in \(([^)]+)\)/', $sql, $match) || str_contains($sql, 'count(')) {
                continue;
            }
            $total += substr_count($match[1], '?');
        }

        return $total;
    }

    protected function seedManyEmployees(int $orgId, int $branchId, int $count, string $prefix): void
    {
        for ($i = 1; $i <= $count; $i++) {
            $employee = Employee::query()->withoutGlobalScopes()->create([
                'organization_id' => $orgId,
                'employee_code' => sprintf('%s%02d', $prefix, $i),
                'full_name' => sprintf('Nhân viên %02d', $i),
                'email' => sprintf('%s-%02d@fresh.test', strtolower($prefix), $i),
                'salary_type' => 'monthly',
                'salary_amount' => 5000000,
                'status' => Employee::STATUS_ACTIVE,
                'employment_type' => 'full_time',
            ]);
            $employee->branches()->attach($branchId, [
                'is_primary' => true,
                'assigned_at' => now(),
            ]);
        }
    }

    protected function formatBytes(int $bytes): string
    {
        if ($bytes < 1024) {
            return $bytes.'B';
        }

        return round($bytes / 1024).'KB';
    }
}
