<?php

namespace Tests\Feature\Timesheet;

use App\Models\AttendanceLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
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
    }
}
