<?php

namespace Tests\Feature\Attendance;

use App\Models\AttendanceLog;
use App\Models\Shift;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttendanceModuleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, branch_id: int, org_id: int}
     */
    protected function seedOwnerWithBranch(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-att@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH Att',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH Att',
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

        return [
            'token' => $token,
            'branch_id' => $branch['id'],
            'org_id' => $register['organization']['id'],
        ];
    }

    public function test_dashboard_and_list_roster(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Văn An',
            'email' => 'an-att@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
        ])->assertCreated()->json('data');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/attendances/dashboard?date='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.total', 1)
            ->assertJsonPath('data.not_checked_in', 1);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/attendances?date='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.employee_id', $employee['id'])
            ->assertJsonPath('data.0.ui_status', 'not_checked_in');
    }

    public function test_check_in_and_check_out_flow(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Văn An',
            'email' => 'an-att2@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
        ])->json('data');

        $this->app['auth']->forgetGuards();

        $shiftId = $this->withToken($ctx['token'])
            ->getJson('/api/shifts')
            ->json('data.0.id');

        $this->app['auth']->forgetGuards();

        $log = $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'shift_id' => $shiftId,
            'location_label' => 'Quầy thu ngân',
        ])->assertCreated()
            ->assertJsonPath('data.ui_status', 'working')
            ->assertJsonPath('data.location', 'Quầy thu ngân')
            ->json('data');

        $this->assertNotNull($log['check_in']);
        $this->assertDatabaseHas('attendance_logs', [
            'employee_id' => $employee['id'],
            'status' => AttendanceLog::STATUS_WORKING,
        ]);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/attendances/check-out', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
        ])->assertOk()
            ->assertJsonPath('data.ui_status', 'checked_out');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/attendances/dashboard')
            ->assertOk()
            ->assertJsonPath('data.checked_in', 1)
            ->assertJsonPath('data.working', 0);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/attendances/shifts/today')
            ->assertOk()
            ->assertJsonStructure(['data' => [['id', 'name', 'checked', 'total']]]);
    }

    public function test_update_creates_adjustment(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'An',
            'email' => 'an-att3@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
        ])->json('data');

        $this->app['auth']->forgetGuards();

        $log = $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'location_label' => 'Khu bếp',
        ])->json('data');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->putJson('/api/attendances/'.$log['id'], [
                'location_label' => 'Khu bàn 1',
                'reason' => 'Sửa vị trí',
            ])
            ->assertOk()
            ->assertJsonPath('data.location', 'Khu bàn 1');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/attendances/'.$log['id'].'/adjustments')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
