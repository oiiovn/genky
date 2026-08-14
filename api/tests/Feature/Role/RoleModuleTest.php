<?php

namespace Tests\Feature\Role;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class RoleModuleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, org_id: int}
     */
    protected function seedOwnerWithBranch(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-roles@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH Roles',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH Roles',
            'phone' => '0901111111',
            'address' => 'Gò Vấp',
        ]);
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/branch', [
            'name' => 'Tân Sơn',
            'address' => '123 Tân Sơn',
            'check_in_radius_meters' => 100,
        ])->assertCreated();
        $this->app['auth']->forgetGuards();

        return [
            'token' => $token,
            'org_id' => $register['organization']['id'],
        ];
    }

    public function test_owner_can_list_default_roles_and_manage_custom_role(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $list = $this->withToken($ctx['token'])
            ->getJson('/api/roles')
            ->assertOk()
            ->json('data');

        $this->assertGreaterThanOrEqual(5, count($list));
        $owner = collect($list)->firstWhere('slug', 'owner');
        $this->assertNotNull($owner);
        $this->assertTrue($owner['is_default']);
        $this->assertGreaterThanOrEqual(1, $owner['member_count']);
        $this->assertArrayHasKey('employees', $owner['permissions']);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/roles/catalog')
            ->assertOk()
            ->assertJsonStructure(['data' => ['actions', 'groups']]);

        $this->app['auth']->forgetGuards();

        $created = $this->withToken($ctx['token'])
            ->postJson('/api/roles', [
                'name' => 'Quản lý ca',
                'description' => 'Phân ca và chấm công',
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame('Quản lý ca', $created['name']);
        $this->assertFalse($created['is_system']);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->putJson('/api/roles/'.$created['id'], [
                'name' => 'Quản lý ca sáng',
                'description' => 'Chỉ ca sáng',
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'Quản lý ca sáng');

        $this->app['auth']->forgetGuards();

        $perms = $created['permissions'];
        $perms['attendance']['view'] = true;
        $perms['attendance']['create'] = true;

        $this->withToken($ctx['token'])
            ->putJson('/api/roles/'.$created['id'].'/permissions', [
                'permissions' => $perms,
            ])
            ->assertOk()
            ->assertJsonPath('data.permissions.attendance.view', true)
            ->assertJsonPath('data.permissions.attendance.create', true);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->putJson('/api/roles/'.$owner['id'], [
                'name' => 'Hack owner',
            ])
            ->assertStatus(422);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->deleteJson('/api/roles/'.$created['id'])
            ->assertOk();
    }
}
