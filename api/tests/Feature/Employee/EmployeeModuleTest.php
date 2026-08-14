<?php

namespace Tests\Feature\Employee;

use App\Models\Branch;
use App\Models\Employee;
use App\Models\OrganizationUser;
use App\Models\Position;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EmployeeModuleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, branch_id: int, org_id: int}
     */
    protected function seedOwnerWithBranch(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH - Bánh tráng trộn',
        ])->json();

        $token = $register['access_token'];

        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH - Bánh tráng trộn',
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

    public function test_owner_can_create_and_list_employee_with_position_and_branch(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $positions = $this->withToken($ctx['token'])
            ->getJson('/api/positions')
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($positions);
        $phucVu = collect($positions)->firstWhere('name', 'Phục vụ');

        $this->app['auth']->forgetGuards();

        $created = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Văn An',
            'phone' => '0902222222',
            'email' => 'an@fresh.test',
            'position_id' => $phucVu['id'],
            'salary_type' => 'hourly',
            'salary_amount' => 25000,
            'branch_ids' => [$ctx['branch_id']],
            'primary_branch_id' => $ctx['branch_id'],
        ])->assertCreated()
            ->assertJsonPath('data.employee_code', 'NV001')
            ->assertJsonPath('data.full_name', 'Nguyễn Văn An')
            ->assertJsonPath('data.position.name', 'Phục vụ')
            ->assertJsonPath('data.branches.0.name', 'Lê Đức Thọ')
            ->assertJsonPath('data.branches.0.is_primary', true);

        $id = $created->json('data.id');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/employees?search=An&status=active&branch_id='.$ctx['branch_id'])
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $id);
    }

    public function test_employee_role_cannot_create_and_only_sees_self(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $this->app['auth']->forgetGuards();
        $positions = $this->withToken($ctx['token'])->getJson('/api/positions')->json('data');
        $positionId = $positions[0]['id'];

        $this->app['auth']->forgetGuards();
        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nhân Viên A',
            'position_id' => $positionId,
            'branch_ids' => [$ctx['branch_id']],
        ])->json('data');

        $staffUser = User::factory()->create([
            'email' => 'staff@fresh.test',
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
            'login' => 'staff@fresh.test',
            'password' => 'Password1!',
        ])->json();

        $this->app['auth']->forgetGuards();

        $this->withToken($login['access_token'])
            ->postJson('/api/employees', [
                'full_name' => 'Hack',
                'branch_ids' => [$ctx['branch_id']],
            ])
            ->assertForbidden();

        $this->app['auth']->forgetGuards();

        $this->withToken($login['access_token'])
            ->getJson('/api/employees')
            ->assertForbidden();
    }

    public function test_tenant_isolation_for_employees(): void
    {
        $a = $this->seedOwnerWithBranch();

        $this->app['auth']->forgetGuards();
        $bRegister = $this->postJson('/api/auth/register', [
            'name' => 'Nguyễn A',
            'email' => 'a@abc.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'ABC Coffee',
        ])->json();

        $this->app['auth']->forgetGuards();
        $this->withToken($bRegister['access_token'])->postJson('/api/onboarding/organization', [
            'name' => 'ABC Coffee',
            'phone' => '0903333333',
            'address' => 'Q1',
        ]);
        $this->app['auth']->forgetGuards();
        $bBranch = $this->withToken($bRegister['access_token'])->postJson('/api/onboarding/branch', [
            'name' => 'Quận 1',
            'address' => 'Q1',
        ])->json('branch');

        $this->app['auth']->forgetGuards();
        $empA = $this->withToken($a['token'])->postJson('/api/employees', [
            'full_name' => 'Nhân FRESH',
            'branch_ids' => [$a['branch_id']],
        ])->json('data');

        $this->app['auth']->forgetGuards();
        $this->withToken($bRegister['access_token'])
            ->getJson('/api/employees/'.$empA['id'])
            ->assertNotFound();

        $this->app['auth']->forgetGuards();
        $this->withToken($bRegister['access_token'])
            ->getJson('/api/employees')
            ->assertOk()
            ->assertJsonPath('meta.total', 0);

        $this->assertSame(1, Branch::query()->withoutGlobalScopes()->where('id', $bBranch['id'])->count());
    }

    public function test_invite_employee_creates_token(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $this->app['auth']->forgetGuards();

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Văn An',
            'email' => 'an@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
        ])->json('data');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->postJson('/api/employees/'.$employee['id'].'/invite')
            ->assertCreated()
            ->assertJsonPath('data.email', 'an@fresh.test')
            ->assertJsonStructure(['data' => ['token', 'invite_url', 'expires_at']]);
    }

    public function test_accept_invitation_creates_employee_account(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $this->app['auth']->forgetGuards();

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Văn An',
            'email' => 'an@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
        ])->json('data');

        $this->app['auth']->forgetGuards();

        $invite = $this->withToken($ctx['token'])
            ->postJson('/api/employees/'.$employee['id'].'/invite')
            ->assertCreated()
            ->json('data');

        $this->app['auth']->forgetGuards();

        $this->getJson('/api/invitations/'.$invite['token'])
            ->assertOk()
            ->assertJsonPath('data.email', 'an@fresh.test')
            ->assertJsonPath('data.is_valid', true)
            ->assertJsonPath('data.employee.full_name', 'Nguyễn Văn An');

        $session = $this->postJson('/api/invitations/'.$invite['token'].'/accept', [
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ])->assertOk()
            ->assertJsonPath('role', OrganizationUser::ROLE_EMPLOYEE)
            ->assertJsonPath('user.email', 'an@fresh.test')
            ->json();

        $this->assertNotEmpty($session['access_token']);

        $this->assertDatabaseHas('employees', [
            'id' => $employee['id'],
            'user_id' => $session['user']['id'],
        ]);

        $this->assertDatabaseHas('organization_user', [
            'organization_id' => $ctx['org_id'],
            'user_id' => $session['user']['id'],
            'role' => OrganizationUser::ROLE_EMPLOYEE,
        ]);

        $this->app['auth']->forgetGuards();

        $this->postJson('/api/invitations/'.$invite['token'].'/accept', [
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
        ])->assertStatus(422);
    }
}

