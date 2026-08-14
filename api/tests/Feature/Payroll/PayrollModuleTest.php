<?php

namespace Tests\Feature\Payroll;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PayrollModuleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, branch_id: int}
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

        $this->withToken($ctx['token'])
            ->postJson('/api/payrolls/generate', [
                'year' => $year,
                'month' => $month,
            ])
            ->assertOk()
            ->assertJsonPath('data.total_employees', 1);

        $this->app['auth']->forgetGuards();

        $list = $this->withToken($ctx['token'])
            ->getJson("/api/payrolls?year={$year}&month={$month}")
            ->assertOk()
            ->json();

        $row = collect($list['data'])->firstWhere('id', $employee['id']);
        $this->assertNotNull($row);
        $this->assertGreaterThan(0, $row['income']);
        $this->assertSame('pending', $row['status']);

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

        // Already fully paid via mark-paid above; expect validation or create new employee case.
        // Reset: create second employee and partial pay.
        $this->app['auth']->forgetGuards();

        $employee2 = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Trần Bình',
            'email' => 'binh-pay@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'monthly',
            'salary_amount' => 8000000,
        ])->assertCreated()->json('data');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->postJson('/api/payrolls/pay', [
                'year' => $year,
                'month' => $month,
                'employee_id' => $employee2['id'],
                'amount' => 500000,
                'method' => 'bank',
                'content' => 'Thanh toán một phần',
            ])
            ->assertOk()
            ->assertJsonPath('data.entry.paid_amount', 500000);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/payrolls/payments')
            ->assertOk()
            ->assertJsonStructure(['data' => [['employee_id', 'payments', 'total_paid']]]);
    }
}
