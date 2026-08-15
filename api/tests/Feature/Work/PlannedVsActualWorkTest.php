<?php

namespace Tests\Feature\Work;

use App\Models\LeaveRequest;
use App\Models\MonthlyWorkSummary;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlannedVsActualWorkTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, branch_id: int, org_id: int}
     */
    protected function seedOwnerWithBranch(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-pva@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH PVA',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH PVA',
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

    /**
     * @return array<string, mixed>
     */
    protected function createEmployee(string $token, int $branchId, string $email, string $salaryType = 'monthly', int $salary = 10000000): array
    {
        $employee = $this->withToken($token)->postJson('/api/employees', [
            'full_name' => 'Nhân viên PVA',
            'email' => $email,
            'branch_ids' => [$branchId],
            'salary_type' => $salaryType,
            'salary_amount' => $salary,
        ])->assertCreated()->json('data');
        $this->app['auth']->forgetGuards();

        return $employee;
    }

    /**
     * @return array<string, mixed>
     */
    protected function createEightHourShift(string $token, int $branchId, string $code = 'C8H'): array
    {
        $shift = $this->withToken($token)->postJson('/api/shifts', [
            'name' => 'Ca 8 giờ',
            'code' => $code,
            'start_time' => '08:00',
            'end_time' => '16:00',
            'break_time' => 0,
            'color' => '#3BB2F6',
            'branch_id' => $branchId,
        ])->assertCreated()->json('data');
        $this->app['auth']->forgetGuards();

        return $shift;
    }

    protected function assignShift(string $token, int $employeeId, int $shiftId, int $branchId, string $date): void
    {
        $this->withToken($token)->postJson('/api/shift-assignments', [
            'employee_id' => $employeeId,
            'shift_id' => $shiftId,
            'branch_id' => $branchId,
            'date' => $date,
        ])->assertCreated();
        $this->app['auth']->forgetGuards();
    }

    protected function checkInOut(
        string $token,
        int $employeeId,
        int $branchId,
        string $date,
        string $in,
        string $out,
    ): void {
        $this->withToken($token)->postJson('/api/attendances/check-in', [
            'employee_id' => $employeeId,
            'branch_id' => $branchId,
            'work_date' => $date,
            'check_in_time' => $in,
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/attendances/check-out', [
            'employee_id' => $employeeId,
            'branch_id' => $branchId,
            'work_date' => $date,
            'check_out_time' => $out,
        ])->assertOk();
        $this->app['auth']->forgetGuards();
    }

    /**
     * @return array<string, mixed>
     */
    protected function timesheetRow(string $token, int $employeeId, int $year, int $month): array
    {
        $list = $this->withToken($token)
            ->getJson("/api/timesheets?year={$year}&month={$month}")
            ->assertOk()
            ->json();
        $this->app['auth']->forgetGuards();

        $row = collect($list['data'])->firstWhere('id', $employeeId);
        $this->assertNotNull($row);

        return $row;
    }

    /**
     * @return array{list: array<string, mixed>, row: array<string, mixed>}
     */
    protected function payrollRow(string $token, int $employeeId, int $year, int $month): array
    {
        $list = $this->withToken($token)
            ->getJson("/api/payrolls?year={$year}&month={$month}")
            ->assertOk()
            ->json();
        $this->app['auth']->forgetGuards();

        $row = collect($list['data'])->firstWhere('id', $employeeId);
        $this->assertNotNull($row);

        return ['list' => $list, 'row' => $row];
    }

    protected function summary(int $employeeId, int $year, int $month): MonthlyWorkSummary
    {
        $summary = MonthlyWorkSummary::query()
            ->withoutGlobalScopes()
            ->where('employee_id', $employeeId)
            ->where('year', $year)
            ->where('month', $month)
            ->where('branch_id', 0)
            ->first();

        $this->assertNotNull($summary);

        return $summary;
    }

    public function test_scheduled_without_attendance_is_not_actual_work(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;
        $date = now()->toDateString();

        $employee = $this->createEmployee($ctx['token'], $ctx['branch_id'], 'pva-a@fresh.test');
        $shift = $this->createEightHourShift($ctx['token'], $ctx['branch_id']);
        $this->assignShift($ctx['token'], $employee['id'], $shift['id'], $ctx['branch_id'], $date);

        $ts = $this->timesheetRow($ctx['token'], $employee['id'], $year, $month);
        $this->assertSame(0, $ts['work_minutes']);
        $this->assertSame(0, $ts['work_days']);

        $pay = $this->payrollRow($ctx['token'], $employee['id'], $year, $month);
        $this->assertSame(0, $pay['row']['income']);
        $this->assertSame(0, $pay['row']['net']);
        $this->assertSame(0, $pay['list']['stats']['income']);

        $summary = $this->summary($employee['id'], $year, $month);
        $this->assertSame(0, $summary->work_minutes);
        $this->assertSame(0, $summary->work_days);
        $this->assertSame(0, $summary->payroll_worked_minutes);
        $this->assertSame(480, $summary->payroll_assignment_minutes);
        $this->assertSame(0, $summary->payroll_total_minutes);
    }

    public function test_attendance_without_schedule_counts_actual_minutes(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;
        $date = now()->toDateString();

        $employee = $this->createEmployee($ctx['token'], $ctx['branch_id'], 'pva-c@fresh.test');
        $this->checkInOut($ctx['token'], $employee['id'], $ctx['branch_id'], $date, '08:00', '12:00');

        $ts = $this->timesheetRow($ctx['token'], $employee['id'], $year, $month);
        $this->assertSame(240, $ts['work_minutes']);
        $this->assertSame(1, $ts['work_days']);

        $pay = $this->payrollRow($ctx['token'], $employee['id'], $year, $month);
        $this->assertGreaterThan(0, $pay['row']['income']);
        $this->assertSame($pay['row']['income'], $pay['list']['stats']['income']);

        $summary = $this->summary($employee['id'], $year, $month);
        $this->assertSame(240, $summary->work_minutes);
        $this->assertSame(240, $summary->payroll_worked_minutes);
        $this->assertSame(0, $summary->payroll_assignment_minutes);
    }

    public function test_schedule_plus_attendance_uses_actual_not_planned_minutes(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;
        $date = now()->toDateString();

        $employee = $this->createEmployee($ctx['token'], $ctx['branch_id'], 'pva-b@fresh.test');
        $shift = $this->createEightHourShift($ctx['token'], $ctx['branch_id']);
        $this->assignShift($ctx['token'], $employee['id'], $shift['id'], $ctx['branch_id'], $date);
        $this->checkInOut($ctx['token'], $employee['id'], $ctx['branch_id'], $date, '08:10', '16:00');

        $ts = $this->timesheetRow($ctx['token'], $employee['id'], $year, $month);
        $this->assertSame(470, $ts['work_minutes']);
        $this->assertNotSame(480, $ts['work_minutes']);
        $this->assertSame(1, $ts['work_days']);

        $summary = $this->summary($employee['id'], $year, $month);
        $this->assertSame(470, $summary->payroll_worked_minutes);
        $this->assertSame(0, $summary->payroll_assignment_minutes);

        $pay = $this->payrollRow($ctx['token'], $employee['id'], $year, $month);
        $this->assertGreaterThan(0, $pay['row']['income']);
        $this->assertSame($pay['row']['income'], $pay['list']['stats']['income']);
    }

    public function test_ten_scheduled_days_and_three_attendance_days_count_three_work_days(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;
        $start = Carbon::create($year, $month, 1);

        $employee = $this->createEmployee($ctx['token'], $ctx['branch_id'], 'pva-e@fresh.test');
        $shift = $this->createEightHourShift($ctx['token'], $ctx['branch_id']);

        for ($i = 0; $i < 10; $i++) {
            $this->assignShift(
                $ctx['token'],
                $employee['id'],
                $shift['id'],
                $ctx['branch_id'],
                $start->copy()->addDays($i)->toDateString(),
            );
        }

        $actualMinutes = 0;
        for ($i = 0; $i < 3; $i++) {
            $date = $start->copy()->addDays($i)->toDateString();
            $this->checkInOut($ctx['token'], $employee['id'], $ctx['branch_id'], $date, '08:00', '16:00');
            $actualMinutes += 480;
        }

        $ts = $this->timesheetRow($ctx['token'], $employee['id'], $year, $month);
        $this->assertSame(3, $ts['work_days']);
        $this->assertSame($actualMinutes, $ts['work_minutes']);

        $summary = $this->summary($employee['id'], $year, $month);
        $this->assertSame(3, $summary->work_days);
        $this->assertSame($actualMinutes, $summary->work_minutes);
        $this->assertSame($actualMinutes, $summary->payroll_worked_minutes);
        $this->assertSame(0, $summary->payroll_assignment_minutes);
    }

    public function test_paid_leave_without_attendance_is_not_fake_work(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;
        $date = now()->toDateString();

        $employee = $this->createEmployee($ctx['token'], $ctx['branch_id'], 'pva-d@fresh.test');
        $shift = $this->createEightHourShift($ctx['token'], $ctx['branch_id']);
        $this->assignShift($ctx['token'], $employee['id'], $shift['id'], $ctx['branch_id'], $date);

        $this->withToken($ctx['token'])->postJson('/api/leaves', [
            'employee_id' => $employee['id'],
            'type' => LeaveRequest::TYPE_ANNUAL,
            'from' => $date,
            'to' => $date,
            'reason' => 'Nghỉ phép năm',
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $ts = $this->timesheetRow($ctx['token'], $employee['id'], $year, $month);
        $this->assertSame(0, $ts['work_minutes']);
        $this->assertSame(0, $ts['work_days']);
        $this->assertSame(1, $ts['leave_days']);

        $pay = $this->payrollRow($ctx['token'], $employee['id'], $year, $month);
        $this->assertSame(1, $pay['row']['paid_leave_days']);
        $this->assertSame(0, $pay['row']['unpaid_days']);
        $this->assertGreaterThan(0, $pay['row']['income']);
        $this->assertGreaterThan(0, $pay['row']['total_minutes']);
        $this->assertSame($pay['row']['income'], $pay['list']['stats']['income']);

        $summary = $this->summary($employee['id'], $year, $month);
        $this->assertSame(0, $summary->work_minutes);
        $this->assertSame(0, $summary->payroll_worked_minutes);
        $this->assertSame(0, $summary->payroll_assignment_minutes);
        $this->assertSame(480, $summary->payroll_paid_leave_minutes);
    }

    public function test_monthly_zero_work_and_zero_leave_is_not_half_salary(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;

        $employee = $this->createEmployee(
            $ctx['token'],
            $ctx['branch_id'],
            'pva-g@fresh.test',
            'monthly',
            10000000,
        );

        $pay = $this->payrollRow($ctx['token'], $employee['id'], $year, $month);
        $this->assertSame(0, $pay['row']['income']);
        $this->assertSame(0, $pay['row']['net']);
        $this->assertNotSame(5000000, $pay['row']['income']);
        $this->assertSame(0, $pay['list']['stats']['income']);
        $this->assertSame($pay['row']['income'], $pay['list']['stats']['income']);
    }

    public function test_hourly_zero_work_remains_zero(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;

        $employee = $this->createEmployee(
            $ctx['token'],
            $ctx['branch_id'],
            'pva-h@fresh.test',
            'hourly',
            50000,
        );

        $pay = $this->payrollRow($ctx['token'], $employee['id'], $year, $month);
        $this->assertSame(0, $pay['row']['income']);
        $this->assertSame(0, $pay['row']['net']);
        $this->assertSame($pay['row']['income'], $pay['list']['stats']['income']);
    }

    public function test_sql_payroll_income_matches_php_hydrate_for_worked_and_zero_rows(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;
        $date = now()->toDateString();

        $worked = $this->createEmployee($ctx['token'], $ctx['branch_id'], 'pva-sql-work@fresh.test', 'monthly', 8000000);
        $idle = $this->createEmployee($ctx['token'], $ctx['branch_id'], 'pva-sql-idle@fresh.test', 'monthly', 10000000);
        $this->checkInOut($ctx['token'], $worked['id'], $ctx['branch_id'], $date, '08:00', '17:00');

        $list = $this->withToken($ctx['token'])
            ->getJson("/api/payrolls?year={$year}&month={$month}")
            ->assertOk()
            ->json();
        $this->app['auth']->forgetGuards();

        $workedRow = collect($list['data'])->firstWhere('id', $worked['id']);
        $idleRow = collect($list['data'])->firstWhere('id', $idle['id']);
        $this->assertNotNull($workedRow);
        $this->assertNotNull($idleRow);
        $this->assertGreaterThan(0, $workedRow['income']);
        $this->assertSame(0, $idleRow['income']);
        $this->assertSame(
            $workedRow['income'] + $idleRow['income'],
            $list['stats']['income'],
        );

        $dashboard = $this->withToken($ctx['token'])
            ->getJson("/api/payrolls/dashboard?year={$year}&month={$month}")
            ->assertOk()
            ->json('data');

        $this->assertSame($list['stats']['income'], $dashboard['stats']['income']);
        $this->assertSame($list['stats']['fund'], $dashboard['stats']['fund']);
    }

    public function test_check_in_without_checkout_does_not_fall_back_to_schedule(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;
        $date = now()->toDateString();

        $employee = $this->createEmployee($ctx['token'], $ctx['branch_id'], 'pva-inonly@fresh.test');
        $shift = $this->createEightHourShift($ctx['token'], $ctx['branch_id']);
        $this->assignShift($ctx['token'], $employee['id'], $shift['id'], $ctx['branch_id'], $date);

        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => $date,
            'check_in_time' => '08:00',
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $ts = $this->timesheetRow($ctx['token'], $employee['id'], $year, $month);
        $this->assertSame(0, $ts['work_minutes']);

        $pay = $this->payrollRow($ctx['token'], $employee['id'], $year, $month);
        $this->assertSame(0, $pay['row']['income']);

        $summary = $this->summary($employee['id'], $year, $month);
        $this->assertSame(0, $summary->work_minutes);
        $this->assertSame(0, $summary->payroll_worked_minutes);
        $this->assertSame(0, $summary->payroll_assignment_minutes);
    }

    public function test_overtime_follows_actual_minutes_not_scheduled_shift(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;
        $date = now()->toDateString();

        $employee = $this->createEmployee($ctx['token'], $ctx['branch_id'], 'pva-f@fresh.test');
        $shift = $this->createEightHourShift($ctx['token'], $ctx['branch_id']);
        $this->assignShift($ctx['token'], $employee['id'], $shift['id'], $ctx['branch_id'], $date);
        $this->checkInOut($ctx['token'], $employee['id'], $ctx['branch_id'], $date, '08:00', '18:00');

        $ts = $this->timesheetRow($ctx['token'], $employee['id'], $year, $month);
        $this->assertSame(600, $ts['work_minutes']);
        $this->assertSame(120, $ts['ot_minutes']);
    }
}
