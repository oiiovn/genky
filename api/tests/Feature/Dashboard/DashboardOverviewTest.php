<?php

namespace Tests\Feature\Dashboard;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DashboardOverviewTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, branch_id: int}
     */
    protected function seedOwnerWithBranch(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-dash@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH Dash',
        ])->json();

        $token = $register['access_token'];

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH Dash',
            'phone' => '0901111111',
            'address' => 'Gò Vấp',
        ]);

        $this->app['auth']->forgetGuards();
        $branch = $this->withToken($token)->postJson('/api/onboarding/branch', [
            'name' => 'Lê Đức Thọ',
            'address' => '123 Lê Đức Thọ',
            'check_in_radius_meters' => 100,
        ])->json('branch');

        $this->app['auth']->forgetGuards();

        return ['token' => $token, 'branch_id' => (int) $branch['id']];
    }

    public function test_overview_returns_mobile_dashboard_payload(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $this->withToken($ctx['token'])
            ->getJson('/api/dashboard')
            ->assertOk()
            ->assertJsonPath('greeting.name', 'Vũ')
            ->assertJsonStructure([
                'kpis' => [
                    ['key', 'label', 'value', 'percent', 'color', 'trend'],
                ],
                'attendance_today',
                'salary_projection' => [
                    'month',
                    'total',
                    'total_formatted',
                    'growth',
                    'employees',
                    'basic_salary',
                    'overtime',
                    'bonus',
                    'fine',
                    'others',
                    'breakdown',
                ],
                'performance' => ['overall', 'metrics'],
                'personnel_costs' => ['month', 'total', 'growth', 'days'],
                'upcoming_shifts',
                'notifications',
            ]);
    }

    public function test_salary_projection_uses_payroll_overtime_and_adjustments(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $today = now('Asia/Ho_Chi_Minh')->toDateString();

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn An',
            'email' => 'an-dash@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'hourly',
            'salary_amount' => 25000,
        ])->assertCreated()->json('data');
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => $today,
            'check_in_time' => '08:00',
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/attendances/check-out', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => $today,
            'check_out_time' => '18:00',
        ])->assertOk();
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/adjustments', [
            'employee_id' => $employee['id'],
            'type' => 'reward',
            'category' => 'personal_reward',
            'reason' => 'Thưởng KPI',
            'amount' => 100000,
            'date' => $today,
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/adjustments', [
            'employee_id' => $employee['id'],
            'type' => 'penalty',
            'category' => 'late',
            'reason' => 'Đi trễ',
            'amount' => 20000,
            'date' => $today,
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $projection = $this->withToken($ctx['token'])
            ->getJson('/api/dashboard')
            ->assertOk()
            ->json('salary_projection');

        $this->assertSame(now('Asia/Ho_Chi_Minh')->format('m/Y'), $projection['month']);
        $this->assertSame(1, $projection['employees']);
        $this->assertGreaterThan(0, $projection['basic_salary']);
        $this->assertGreaterThan(0, $projection['overtime']);
        $this->assertSame(100000, $projection['bonus']);
        $this->assertSame(-20000, $projection['fine']);
        $this->assertSame(
            $projection['basic_salary']
            + $projection['overtime']
            + $projection['bonus']
            + $projection['fine']
            + $projection['others'],
            $projection['total'],
        );

        $byLabel = collect($projection['breakdown'])->keyBy('label');
        $this->assertSame($projection['basic_salary'], $byLabel['Lương cơ bản']['value']);
        $this->assertSame($projection['overtime'], $byLabel['Làm thêm giờ']['value']);
        $this->assertSame($projection['bonus'], $byLabel['Thưởng']['value']);
        $this->assertSame($projection['fine'], $byLabel['Phạt']['value']);
        $this->assertSame($projection['others'], $byLabel['Khác']['value']);
    }

    public function test_performance_excludes_leave_from_ontime_and_counts_open_shift_as_incomplete(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $today = now('Asia/Ho_Chi_Minh')->toDateString();

        $onLeave = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Nhi',
            'email' => 'nhi-perf@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'monthly',
            'salary_amount' => 8000000,
        ])->assertCreated()->json('data');
        $this->app['auth']->forgetGuards();

        $working = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Bảo Châu',
            'email' => 'chau-perf@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'hourly',
            'salary_amount' => 25000,
        ])->assertCreated()->json('data');
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/leaves', [
            'employee_id' => $onLeave['id'],
            'type' => 'personal',
            'from' => $today,
            'to' => $today,
            'reason' => 'Việc riêng',
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $shift = $this->withToken($ctx['token'])->postJson('/api/shifts', [
            'name' => 'Ca chiều',
            'code' => 'CCH',
            'start_time' => '11:30',
            'end_time' => '22:00',
            'break_time' => 0,
            'color' => '#F59E0B',
            'branch_id' => $ctx['branch_id'],
        ])->assertCreated()->json('data');
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/shift-assignments', [
            'employee_id' => $working['id'],
            'shift_id' => $shift['id'],
            'branch_id' => $ctx['branch_id'],
            'date' => $today,
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $working['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => $today,
            'check_in_time' => '11:13',
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $payload = $this->withToken($ctx['token'])
            ->getJson('/api/dashboard')
            ->assertOk()
            ->json();

        $byLabel = collect($payload['performance']['metrics'])->keyBy('label');
        $this->assertSame(100, $byLabel['Đúng giờ']['value']);
        $this->assertSame(0, $byLabel['Hoàn thành ca']['value']);
        $this->assertSame(0, $byLabel['Làm thêm']['value']);
        $this->assertSame(50, $byLabel['Nghỉ phép']['value']);
        $this->assertSame(100, $payload['performance']['overall']);
        foreach ($payload['attendance_today'] as $row) {
            $this->assertDoesNotMatchRegularExpression(
                '/\d+\.\d{3,}/',
                (string) ($row['status_label'] ?? ''),
            );
        }
    }

    public function test_personnel_costs_use_attendance_wages_and_adjustments(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $today = now('Asia/Ho_Chi_Minh')->toDateString();
        $day = (int) now('Asia/Ho_Chi_Minh')->format('j');

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Trần Bình',
            'email' => 'binh-cost@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'hourly',
            'salary_amount' => 25000,
        ])->assertCreated()->json('data');
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => $today,
            'check_in_time' => '08:00',
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/attendances/check-out', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => $today,
            'check_out_time' => '17:00',
        ])->assertOk();
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/adjustments', [
            'employee_id' => $employee['id'],
            'type' => 'reward',
            'category' => 'personal_reward',
            'reason' => 'Thưởng',
            'amount' => 100000,
            'date' => $today,
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $payload = $this->withToken($ctx['token'])
            ->getJson('/api/dashboard')
            ->assertOk()
            ->json();

        $costs = $payload['personnel_costs'];
        $this->assertSame(now('Asia/Ho_Chi_Minh')->format('m/Y'), $costs['month']);
        $this->assertGreaterThan(0, $costs['total']);
        $this->assertSame($payload['salary_projection']['total'], $costs['total']);
        $todayPoint = collect($costs['days'])->firstWhere('day', $day);
        $this->assertNotNull($todayPoint);
        $this->assertGreaterThan(0, $todayPoint['value']);
    }

    public function test_personnel_costs_include_in_progress_check_in(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $now = now('Asia/Ho_Chi_Minh');
        $today = $now->toDateString();
        $checkIn = $now->copy()->subHours(2)->format('H:i');

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Lê Open',
            'email' => 'open-cost@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'hourly',
            'salary_amount' => 25000,
        ])->assertCreated()->json('data');
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => $today,
            'check_in_time' => $checkIn,
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $costs = $this->withToken($ctx['token'])
            ->getJson('/api/dashboard')
            ->assertOk()
            ->json('personnel_costs');

        $this->assertGreaterThan(0, $costs['total']);
        $todayPoint = collect($costs['days'])->firstWhere('day', (int) $now->format('j'));
        $this->assertGreaterThan(0, $todayPoint['value']);
    }
}
