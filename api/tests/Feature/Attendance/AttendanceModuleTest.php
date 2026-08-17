<?php

namespace Tests\Feature\Attendance;

use App\Models\AttendanceLog;
use App\Models\Employee;
use App\Models\OrganizationUser;
use App\Models\User;
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
            ->assertJsonPath('data.total', 0)
            ->assertJsonPath('data.not_checked_in', 0);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/attendances?date='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('meta.total', 0)
            ->assertJsonCount(0, 'data');

        $from = now()->startOfWeek()->toDateString();
        $to = now()->toDateString();
        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])
            ->getJson('/api/attendances?from='.$from.'&to='.$to)
            ->assertOk()
            ->assertJsonPath('meta.total', 0)
            ->assertJsonCount(0, 'data');

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])
            ->getJson('/api/attendances/overview?date='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('data.dashboard.total', 0)
            ->assertJsonPath('data.dashboard.not_checked_in', 0)
            ->assertJsonStructure(['data' => ['dashboard', 'shifts']]);
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
        $this->travel(6)->minutes();

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
            ->getJson('/api/attendances?date='.now()->toDateString())
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $log['id'])
            ->assertJsonPath('data.0.ui_status', 'checked_out');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/attendances/shifts/today')
            ->assertOk()
            ->assertJsonStructure(['data' => [['id', 'name', 'checked', 'total']]]);

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])
            ->getJson('/api/attendances/overview')
            ->assertOk()
            ->assertJsonPath('data.dashboard.checked_in', 1)
            ->assertJsonPath('data.dashboard.working', 0)
            ->assertJsonStructure(['data' => ['shifts' => [['id', 'name', 'checked', 'total']]]]);
    }

    public function test_list_paginates_and_filters_on_sql(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $an = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Văn An',
            'email' => 'an-page@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
        ])->json('data');

        $this->app['auth']->forgetGuards();
        $binh = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Trần Thị Bình',
            'email' => 'binh-page@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
        ])->json('data');

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $an['id'],
            'branch_id' => $ctx['branch_id'],
        ])->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $binh['id'],
            'branch_id' => $ctx['branch_id'],
        ])->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])
            ->getJson('/api/attendances?date='.now()->toDateString().'&per_page=1&page=1')
            ->assertOk()
            ->assertJsonPath('meta.total', 2)
            ->assertJsonPath('meta.last_page', 2)
            ->assertJsonCount(1, 'data');

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])
            ->getJson('/api/attendances?date='.now()->toDateString().'&search=Bình')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.full_name', 'Trần Thị Bình');

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])
            ->getJson('/api/attendances?date='.now()->toDateString().'&status=working')
            ->assertOk()
            ->assertJsonPath('meta.total', 2);
    }

    public function test_mine_returns_only_current_employee(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $an = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Văn An',
            'email' => 'an-mine@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
        ])->json('data');

        $this->app['auth']->forgetGuards();
        $binh = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Trần Thị Bình',
            'email' => 'binh-mine@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
        ])->json('data');

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $an['id'],
            'branch_id' => $ctx['branch_id'],
        ])->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $binh['id'],
            'branch_id' => $ctx['branch_id'],
        ])->assertCreated();

        $staffUser = User::factory()->create([
            'email' => 'staff-att@fresh.test',
            'password' => 'Password1!',
        ]);

        OrganizationUser::query()->create([
            'organization_id' => $ctx['org_id'],
            'user_id' => $staffUser->id,
            'role' => OrganizationUser::ROLE_EMPLOYEE,
            'is_default' => true,
        ]);

        $staffUser->forceFill([
            'current_organization_id' => $ctx['org_id'],
        ])->save();

        Employee::query()->withoutGlobalScopes()->whereKey($an['id'])->update([
            'user_id' => $staffUser->id,
        ]);

        $login = $this->postJson('/api/auth/login', [
            'login' => 'staff-att@fresh.test',
            'password' => 'Password1!',
        ])->json();

        $this->app['auth']->forgetGuards();
        $this->withToken($login['access_token'])
            ->getJson('/api/attendances/mine?date='.now()->toDateString())
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.employee_id', $an['id']);

        $from = now()->subDays(6)->toDateString();
        $to = now()->toDateString();
        $this->app['auth']->forgetGuards();
        $this->withToken($login['access_token'])
            ->getJson('/api/attendances/mine?from='.$from.'&to='.$to)
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.employee_id', $an['id']);
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

    public function test_check_out_requires_five_minute_gap(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'An Gap',
            'email' => 'an-gap@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
        ])->json('data');

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
        ])->assertCreated();

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])->postJson('/api/attendances/check-out', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
        ])->assertStatus(422);

        $this->app['auth']->forgetGuards();
        $this->travel(6)->minutes();

        $this->withToken($ctx['token'])->postJson('/api/attendances/check-out', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
        ])->assertOk();
    }

    public function test_geofence_rejects_when_outside_radius(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        \App\Models\Branch::query()->withoutGlobalScopes()->whereKey($ctx['branch_id'])->update([
            'latitude' => 10.7769,
            'longitude' => 106.7009,
            'check_in_radius_meters' => 100,
        ]);

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'An Geo',
            'email' => 'an-geo@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
        ])->json('data');

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'source' => 'qr',
            'latitude' => 10.8000,
            'longitude' => 106.7009,
        ])->assertStatus(422);

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'source' => 'qr',
            'latitude' => 10.7769,
            'longitude' => 106.7009,
        ])->assertCreated();
    }

    public function test_staff_check_status_payload(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'An Staff',
            'email' => 'an-staff-check@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
        ])->json('data');

        $staffUser = User::factory()->create([
            'email' => 'staff-check@fresh.test',
            'password' => 'Password1!',
        ]);

        OrganizationUser::query()->create([
            'organization_id' => $ctx['org_id'],
            'user_id' => $staffUser->id,
            'role' => OrganizationUser::ROLE_EMPLOYEE,
            'is_default' => true,
        ]);

        $staffUser->forceFill([
            'current_organization_id' => $ctx['org_id'],
        ])->save();

        Employee::query()->withoutGlobalScopes()->whereKey($employee['id'])->update([
            'user_id' => $staffUser->id,
        ]);

        $login = $this->postJson('/api/auth/login', [
            'login' => 'staff-check@fresh.test',
            'password' => 'Password1!',
        ])->assertOk()->json();

        $token = $login['access_token'];
        $this->assertNotEmpty($token);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)
            ->getJson('/api/attendances/staff-check?branch_id='.$ctx['branch_id'])
            ->assertOk()
            ->assertJsonPath('data.qr_enabled', true)
            ->assertJsonPath('data.allow_staff_app', false)
            ->assertJsonPath('data.today.can_check_in', false)
            ->assertJsonStructure([
                'data' => [
                    'employee_id',
                    'qr_enabled',
                    'allow_staff_app',
                    'allow_check_in',
                    'allow_check_out',
                    'geofence' => ['required', 'radius_meters'],
                    'today' => [
                        'can_check_in',
                        'can_check_out',
                        'seconds_until_checkout',
                    ],
                ],
            ]);

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])->putJson('/api/attendances/qr/settings', [
            'branch_id' => $ctx['branch_id'],
            'enabled' => true,
            'allow_staff_app' => true,
            'rotate_seconds' => 30,
            'valid_from' => '00:00',
            'valid_to' => '23:59',
            'allow_check_in' => true,
            'allow_check_out' => true,
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)
            ->getJson('/api/attendances/staff-check?branch_id='.$ctx['branch_id'])
            ->assertOk()
            ->assertJsonPath('data.allow_staff_app', true)
            ->assertJsonPath('data.today.can_check_in', true);

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])->putJson('/api/attendances/qr/settings', [
            'branch_id' => $ctx['branch_id'],
            'enabled' => true,
            'allow_staff_app' => false,
            'rotate_seconds' => 30,
            'valid_from' => '00:00',
            'valid_to' => '23:59',
            'allow_check_in' => true,
            'allow_check_out' => true,
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/attendances/check-in', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'source' => 'staff_app',
            'latitude' => 10.7769,
            'longitude' => 106.7009,
        ])->assertStatus(422);
    }

    public function test_list_includes_daily_wage_from_worked_minutes(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $date = now()->toDateString();

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Văn An',
            'email' => 'an-wage@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'hourly',
            'salary_amount' => 25000,
            'pay_from_shift_start' => true,
        ])->assertCreated()->json('data');
        $this->app['auth']->forgetGuards();

        $shift = $this->withToken($ctx['token'])->postJson('/api/shifts', [
            'name' => 'Ca chiều',
            'code' => 'WAGE12',
            'start_time' => '12:00',
            'end_time' => '22:00',
            'break_time' => 0,
            'color' => '#F59E0B',
            'branch_id' => $ctx['branch_id'],
        ])->assertCreated()->json('data');
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/attendances/check-in', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'shift_id' => $shift['id'],
            'work_date' => $date,
            'check_in_time' => '11:27',
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $out = $this->withToken($ctx['token'])->postJson('/api/attendances/check-out', [
            'employee_id' => $employee['id'],
            'branch_id' => $ctx['branch_id'],
            'work_date' => $date,
            'check_out_time' => '22:12',
        ])->assertOk()->json('data');

        $wage = (int) round((25000 * 612) / 60);
        $this->assertSame($wage, $out['daily_wage']);

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])
            ->getJson('/api/attendances?date='.$date)
            ->assertOk()
            ->assertJsonPath('data.0.daily_wage', $wage);

        $this->app['auth']->forgetGuards();
        $year = (int) now()->year;
        $month = (int) now()->month;
        $this->withToken($ctx['token'])
            ->getJson("/api/payrolls?year={$year}&month={$month}")
            ->assertOk()
            ->assertJsonPath('data.0.income', $wage)
            ->assertJsonPath('data.0.total_minutes', 612);
    }
}
