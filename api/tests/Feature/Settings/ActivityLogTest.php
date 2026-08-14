<?php

namespace Tests\Feature\Settings;

use App\Models\ActivityLog;
use App\Models\Employee;
use App\Models\OrganizationUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, org_id: int, branch_id: int}
     */
    protected function seedOwnerWithBranch(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-logs@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH Logs',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH Logs',
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
            'org_id' => $register['organization']['id'],
            'branch_id' => $branch['id'],
        ];
    }

    public function test_guest_cannot_read_activity_logs(): void
    {
        $this->getJson('/api/activity-logs')->assertUnauthorized();
    }

    public function test_owner_sees_login_and_write_actions(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Văn Minh',
            'branch_ids' => [$ctx['branch_id']],
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $list = $this->withToken($ctx['token'])
            ->getJson('/api/activity-logs')
            ->assertOk()
            ->assertJsonStructure(['data', 'users', 'meta' => ['total', 'current_page', 'last_page']])
            ->json();

        $this->assertGreaterThanOrEqual(3, $list['meta']['total']);

        $actions = collect($list['data']);
        $this->assertTrue($actions->contains(fn ($row) => $row['action'] === 'login'));
        $this->assertTrue($actions->contains(
            fn ($row) => $row['action'] === 'create' && str_contains((string) $row['action_label'], 'nhân viên')
        ));
        $this->assertTrue($actions->contains(
            fn ($row) => $row['action'] === 'create' && str_contains((string) $row['object'], 'Lê Văn Quới')
        ));
    }

    public function test_failed_login_is_recorded(): void
    {
        $this->seedOwnerWithBranch();

        $this->postJson('/api/auth/login', [
            'login' => 'owner-logs@fresh.test',
            'password' => 'WrongPass1!',
        ])->assertUnprocessable();

        $this->assertDatabaseHas('activity_logs', [
            'action' => ActivityLog::ACTION_LOGIN,
            'result' => ActivityLog::RESULT_FAIL,
        ]);
    }

    public function test_filters_and_export_work(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Văn Minh',
            'branch_ids' => [$ctx['branch_id']],
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/activity-logs?action=create&search=Minh')
            ->assertOk()
            ->assertJsonPath('data.0.object', 'Nguyễn Văn Minh');

        $this->app['auth']->forgetGuards();

        $export = $this->withToken($ctx['token'])
            ->get('/api/activity-logs/export?action=create')
            ->assertOk();

        $this->assertStringContainsString('text/csv', (string) $export->headers->get('content-type'));
        $this->assertStringContainsString('Thời gian', $export->streamedContent());
    }

    public function test_employee_cannot_view_and_tenants_are_isolated(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $this->app['auth']->forgetGuards();
        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nhân Viên A',
            'branch_ids' => [$ctx['branch_id']],
        ])->json('data');

        $staffUser = User::factory()->create([
            'email' => 'staff-logs@fresh.test',
            'password' => 'Password1!',
        ]);

        OrganizationUser::query()->create([
            'organization_id' => $ctx['org_id'],
            'user_id' => $staffUser->id,
            'role' => OrganizationUser::ROLE_EMPLOYEE,
            'is_default' => true,
        ]);
        $staffUser->forceFill(['current_organization_id' => $ctx['org_id']])->save();
        Employee::query()->withoutGlobalScopes()->whereKey($employee['id'])->update([
            'user_id' => $staffUser->id,
        ]);

        $login = $this->postJson('/api/auth/login', [
            'login' => 'staff-logs@fresh.test',
            'password' => 'Password1!',
        ])->json();
        $this->app['auth']->forgetGuards();

        $this->withToken($login['access_token'])
            ->getJson('/api/activity-logs')
            ->assertForbidden();

        $this->app['auth']->forgetGuards();
        $other = $this->postJson('/api/auth/register', [
            'name' => 'Nguyễn A',
            'email' => 'a-logs@abc.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'ABC Coffee',
        ])->json();
        $this->app['auth']->forgetGuards();

        $otherLogs = $this->withToken($other['access_token'])
            ->getJson('/api/activity-logs')
            ->assertOk()
            ->json('data');

        $this->assertFalse(collect($otherLogs)->contains(
            fn ($row) => str_contains((string) ($row['object'] ?? ''), 'Nhân Viên A')
        ));
    }
}
