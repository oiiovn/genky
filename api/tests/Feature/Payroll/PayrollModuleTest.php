<?php

namespace Tests\Feature\Payroll;

use App\Models\Employee;
use App\Models\MonthlyWorkSummary;
use App\Models\PayrollEntry;
use App\Models\User;
use App\Services\Employee\EmployeeService;
use App\Services\Payroll\PayrollService;
use App\Services\Work\MonthlyWorkSummaryService;
use App\Support\Tenancy\TenantContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PayrollModuleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, branch_id: int, org_id: int}
     */
    protected function seedOwnerWithBranch(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-pay@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH Pay',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH Pay',
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

    public function test_list_generate_and_mark_paid(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Nhi',
            'email' => 'nhi-pay@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'monthly',
            'salary_amount' => 10000000,
        ])->assertCreated()->json('data');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => now()->toDateString(),
            'check_in_time' => '08:00',
        ])->assertCreated();

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/attendances/check-out', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => now()->toDateString(),
            'check_out_time' => '17:00',
        ])->assertOk();

        $this->app['auth']->forgetGuards();

        $employee2 = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Trần Bình',
            'email' => 'binh-pay@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'monthly',
            'salary_amount' => 8000000,
        ])->assertCreated()->json('data');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $employee2['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => now()->toDateString(),
            'check_in_time' => '08:00',
        ])->assertCreated();

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/attendances/check-out', [
            'employee_id' => $employee2['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => now()->toDateString(),
            'check_out_time' => '17:00',
        ])->assertOk();

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->postJson('/api/payrolls/generate', [
                'year' => $year,
                'month' => $month,
            ])
            ->assertOk()
            ->assertJsonPath('data.total_employees', 2);

        $this->app['auth']->forgetGuards();

        $list = $this->withToken($ctx['token'])
            ->getJson("/api/payrolls?year={$year}&month={$month}")
            ->assertOk()
            ->json();

        $row = collect($list['data'])->firstWhere('id', $employee['id']);
        $this->assertNotNull($row);
        $this->assertGreaterThan(0, $row['income']);
        $this->assertSame('pending', $row['status']);
        $this->assertDatabaseHas('monthly_work_summaries', [
            'employee_id' => $employee['id'],
            'year' => $year,
            'month' => $month,
            'branch_id' => 0,
        ]);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->postJson('/api/payrolls/mark-paid', [
                'year' => $year,
                'month' => $month,
                'employee_ids' => [$employee['id']],
                'status' => 'paid',
            ])
            ->assertOk()
            ->assertJsonPath('data.count', 1);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson("/api/payrolls?year={$year}&month={$month}&status=paid")
            ->assertOk()
            ->assertJsonPath('summary.paid', 1);

        $this->assertDatabaseHas('payroll_entries', [
            'employee_id' => $employee['id'],
            'year' => $year,
            'month' => $month,
            'status' => 'paid',
        ]);

        $this->app['auth']->forgetGuards();

        $history = $this->withToken($ctx['token'])
            ->getJson('/api/payrolls/history')
            ->assertOk()
            ->json();

        $this->assertGreaterThanOrEqual(1, $history['meta']['total']);
        $sheet = collect($history['data'])->firstWhere(
            fn ($s) => (int) $s['year'] === $year && (int) $s['month'] === $month
        );
        $this->assertNotNull($sheet);

        $this->app['auth']->forgetGuards();

        $detail = $this->withToken($ctx['token'])
            ->getJson("/api/payrolls/history/{$year}/{$month}")
            ->assertOk()
            ->json();

        $this->assertSame($year, $detail['sheet']['year']);
        $this->assertGreaterThanOrEqual(1, count($detail['data']));

        $this->app['auth']->forgetGuards();

        $pay = $this->withToken($ctx['token'])
            ->postJson('/api/payrolls/pay', [
                'year' => $year,
                'month' => $month,
                'employee_id' => $employee['id'],
                'amount' => 100000,
                'method' => 'cash',
                'content' => 'Ứng lương',
            ]);

        // Already fully paid via mark-paid above. Partial-pay the second employee
        // who still has pending net from actual attendance.
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->postJson('/api/payrolls/pay', [
                'year' => $year,
                'month' => $month,
                'employee_id' => $employee2['id'],
                'amount' => 100000,
                'method' => 'bank',
                'content' => 'Thanh toán một phần',
            ])
            ->assertOk()
            ->assertJsonPath('data.entry.paid_amount', 100000);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/payrolls/payments')
            ->assertOk()
            ->assertJsonStructure(['data' => [['employee_id', 'payments', 'total_paid']]]);
    }

    public function test_list_reuses_monthly_summary_when_source_unchanged(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;

        $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Nhi',
            'email' => 'nhi-pay-cache@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'monthly',
            'salary_amount' => 10000000,
        ])->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])
            ->getJson("/api/payrolls?year={$year}&month={$month}")
            ->assertOk();

        $first = MonthlyWorkSummary::query()
            ->withoutGlobalScopes()
            ->where('year', $year)
            ->where('month', $month)
            ->where('branch_id', 0)
            ->value('computed_at');

        $this->assertNotNull($first);

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])
            ->getJson("/api/payrolls?year={$year}&month={$month}")
            ->assertOk()
            ->assertJsonPath('stats.employees', 1);

        $second = MonthlyWorkSummary::query()
            ->withoutGlobalScopes()
            ->where('year', $year)
            ->where('month', $month)
            ->where('branch_id', 0)
            ->value('computed_at');

        $this->assertSame((string) $first, (string) $second);
    }

    public function test_dashboard_stats_match_list_without_full_rows(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;

        $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Nhi',
            'email' => 'nhi-pay-dash@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'monthly',
            'salary_amount' => 10000000,
        ])->assertCreated();

        $this->app['auth']->forgetGuards();
        $list = $this->withToken($ctx['token'])
            ->getJson("/api/payrolls?year={$year}&month={$month}")
            ->assertOk()
            ->json();

        $this->app['auth']->forgetGuards();
        $dashboard = $this->withToken($ctx['token'])
            ->getJson("/api/payrolls/dashboard?year={$year}&month={$month}")
            ->assertOk()
            ->json('data');

        $this->assertSame($list['stats']['employees'], $dashboard['stats']['employees']);
        $this->assertSame($list['stats']['fund'], $dashboard['stats']['fund']);
        $this->assertSame($list['stats']['income'], $dashboard['stats']['income']);
        $this->assertSame($list['summary']['pending'], $dashboard['summary']['pending']);
        $this->assertSame(0, $list['stats']['income']);
        $this->assertTrue(Schema::hasTable('monthly_work_summaries'));
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
                'email' => "pay-page-{$i}@fresh.test",
                'branch_ids' => [$ctx['branch_id']],
                'salary_type' => 'monthly',
                'salary_amount' => 8000000,
            ])->assertCreated();
        }

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])
            ->postJson('/api/payrolls/generate', [
                'year' => $year,
                'month' => $month,
            ])
            ->assertOk()
            ->assertJsonPath('data.total_employees', 12);

        $this->app['auth']->forgetGuards();
        $page1 = $this->withToken($ctx['token'])
            ->getJson("/api/payrolls?year={$year}&month={$month}&per_page=10&page=1")
            ->assertOk()
            ->json();

        $this->assertSame(12, $page1['meta']['total']);
        $this->assertSame(2, $page1['meta']['last_page']);
        $this->assertCount(10, $page1['data']);
        $this->assertSame($page1['stats']['employees'], $page1['meta']['total']);
        $this->assertSame(12, $page1['summary']['pending']);

        $this->app['auth']->forgetGuards();
        $page2 = $this->withToken($ctx['token'])
            ->getJson("/api/payrolls?year={$year}&month={$month}&per_page=10&page=2")
            ->assertOk()
            ->json();

        $this->assertCount(2, $page2['data']);
        $ids = collect($page1['data'])->pluck('id')->merge(collect($page2['data'])->pluck('id'));
        $this->assertCount(12, $ids->unique());

        $this->app['auth']->forgetGuards();
        $search = $this->withToken($ctx['token'])
            ->getJson("/api/payrolls?year={$year}&month={$month}&search=".urlencode('Nhân viên 01'))
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
        $this->seedManyEmployees($ctx['org_id'], $ctx['branch_id'], 40, 'PAY');

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])
            ->postJson('/api/payrolls/generate', [
                'year' => $year,
                'month' => $month,
            ])
            ->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])
            ->getJson("/api/payrolls?year={$year}&month={$month}&per_page=10")
            ->assertOk();

        $user = User::query()->where('email', 'owner-pay@fresh.test')->firstOrFail();
        $this->actingAs($user, 'sanctum');
        TenantContext::fromUser($user);

        $before = $this->measureList(function () use ($year, $month) {
            $employees = Employee::query()
                ->where('employees.status', Employee::STATUS_ACTIVE)
                ->with(['position', 'branches'])
                ->orderBy('employees.full_name')
                ->get();
            $summaries = app(MonthlyWorkSummaryService::class)->forMonth($year, $month, null);
            $entries = PayrollEntry::query()
                ->whereIn('employee_id', $employees->pluck('id'))
                ->where('year', $year)
                ->where('month', $month)
                ->get()
                ->keyBy('employee_id');
            $payload = app(EmployeeService::class);
            $rows = $employees->map(function (Employee $employee) use ($entries, $payload) {
                $employee->loadMissing(['position', 'role', 'branches']);

                return [
                    'id' => $employee->id,
                    'employee' => $payload->payload($employee),
                    'department' => $employee->position?->name ?? 'Chưa phân bổ',
                    'status' => $entries->get($employee->id)?->status ?? PayrollEntry::STATUS_PENDING,
                    'net' => (int) ($entries->get($employee->id)?->net ?? 0),
                ];
            });

            return [
                'data' => $rows->slice(0, 10)->values(),
                'hydrated' => $employees->count(),
            ];
        });

        $after = $this->measureList(function () use ($year, $month) {
            return app(PayrollService::class)->list([
                'year' => $year,
                'month' => $month,
                'per_page' => 10,
                'page' => 1,
            ]);
        });

        $this->assertCount(10, $after['result']['data']);
        $this->assertSame(40, $after['result']['meta']['total']);
        $this->assertSame(40, $before['result']['hydrated']);
        $this->assertLessThanOrEqual(10, $after['employees']);
        $this->assertLessThanOrEqual(10, $after['summaries']);
        $this->assertLessThanOrEqual(10, $after['entries']);
        $this->assertLessThan($before['result']['hydrated'], $after['employees']);

        fwrite(STDERR, sprintf(
            "\nPayroll list (40 employees, page=10, warmed)\n".
            "          queries  emp_rows  summary_rows  entry_rows  memory    time\n".
            "before    %-8d %-9d %-13d %-11d %-9s %.1fms\n".
            "after     %-8d %-9d %-13d %-11d %-9s %.1fms\n",
            $before['queries'],
            $before['result']['hydrated'],
            $before['summaries'],
            $before['entries'],
            $this->formatBytes($before['memory']),
            $before['ms'],
            $after['queries'],
            $after['employees'],
            $after['summaries'],
            $after['entries'],
            $this->formatBytes($after['memory']),
            $after['ms'],
        ));
    }

    /**
     * @param  callable(): mixed  $callback
     * @return array{queries: int, employees: int, summaries: int, entries: int, memory: int, ms: float, result: mixed}
     */
    protected function measureList(callable $callback): array
    {
        $employees = 0;
        $summaries = 0;
        $entries = 0;
        $active = true;
        Employee::retrieved(static function () use (&$employees, &$active) {
            if ($active) {
                $employees++;
            }
        });
        MonthlyWorkSummary::retrieved(static function () use (&$summaries, &$active) {
            if ($active) {
                $summaries++;
            }
        });
        PayrollEntry::retrieved(static function () use (&$entries, &$active) {
            if ($active) {
                $entries++;
            }
        });

        gc_collect_cycles();
        DB::flushQueryLog();
        DB::enableQueryLog();
        $memory = memory_get_usage();
        $started = hrtime(true);
        $result = $callback();
        $ms = (hrtime(true) - $started) / 1e6;
        $queries = count(DB::getQueryLog());
        DB::disableQueryLog();
        $active = false;

        return [
            'queries' => $queries,
            'employees' => $employees,
            'summaries' => $summaries,
            'entries' => $entries,
            'memory' => max(0, memory_get_usage() - $memory),
            'ms' => $ms,
            'result' => $result,
        ];
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
                'salary_amount' => 8000000,
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

    public function test_hourly_income_is_minutes_times_rate_per_minute(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Lương Giờ',
            'email' => 'hourly-pay@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'hourly',
            'salary_amount' => 25000,
        ])->assertCreated()->json('data');

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => now()->toDateString(),
            'check_in_time' => '08:00',
        ])->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->travel(61)->minutes();
        $this->withToken($ctx['token'])->postJson('/api/attendances/check-out', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => now()->toDateString(),
            'check_out_time' => '09:01',
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])
            ->postJson('/api/payrolls/generate', [
                'year' => $year,
                'month' => $month,
            ])
            ->assertOk();

        $this->app['auth']->forgetGuards();
        $list = $this->withToken($ctx['token'])
            ->getJson("/api/payrolls?year={$year}&month={$month}")
            ->assertOk()
            ->json();

        $row = collect($list['data'])->firstWhere('id', $employee['id']);
        $this->assertNotNull($row);
        $this->assertSame(61, (int) $row['total_minutes']);
        $this->assertSame((int) round((25000 * 61) / 60), (int) $row['income']);
    }

    public function test_hourly_income_does_not_apply_overtime_multiplier(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Không OT',
            'email' => 'no-ot-pay@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'hourly',
            'salary_amount' => 25000,
        ])->assertCreated()->json('data');

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => now()->toDateString(),
            'check_in_time' => '08:00',
        ])->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->travel(10)->hours();
        $this->withToken($ctx['token'])->postJson('/api/attendances/check-out', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => now()->toDateString(),
            'check_out_time' => '18:00',
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])
            ->postJson('/api/payrolls/generate', [
                'year' => $year,
                'month' => $month,
            ])
            ->assertOk();

        $this->app['auth']->forgetGuards();
        $list = $this->withToken($ctx['token'])
            ->getJson("/api/payrolls?year={$year}&month={$month}")
            ->assertOk()
            ->json();

        $row = collect($list['data'])->firstWhere('id', $employee['id']);
        $this->assertNotNull($row);
        $this->assertSame(600, (int) $row['total_minutes']);
        $this->assertSame(250000, (int) $row['income']);
        $this->assertNotSame(275000, (int) $row['income']);
    }
}
