<?php

namespace Tests\Feature\Organization;

use App\Models\Branch;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class OrganizationBranchTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_then_onboarding_organization_and_branch(): void
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'vu@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH - Bánh tráng trộn',
        ])->assertCreated();

        $token = $register->json('access_token');

        $this->withToken($token)
            ->getJson('/api/onboarding/status')
            ->assertOk()
            ->assertJsonPath('next_step', 'organization')
            ->assertJsonPath('setup_completed', false);

        $this->withToken($token)
            ->postJson('/api/onboarding/organization', [
                'name' => 'FRESH - Bánh tráng trộn',
                'phone' => '0901234567',
                'address' => '123 Lê Đức Thọ, Gò Vấp',
            ])
            ->assertOk()
            ->assertJsonPath('next_step', 'branch');

        $this->withToken($token)
            ->postJson('/api/onboarding/branch', [
                'name' => 'Lê Đức Thọ',
                'address' => '123 Lê Đức Thọ, Gò Vấp',
                'latitude' => 10.8381,
                'longitude' => 106.6675,
                'check_in_radius_meters' => 100,
            ])
            ->assertCreated()
            ->assertJsonPath('next_step', 'dashboard')
            ->assertJsonPath('branch.name', 'Lê Đức Thọ');

        $this->withToken($token)
            ->getJson('/api/onboarding/status')
            ->assertOk()
            ->assertJsonPath('setup_completed', true)
            ->assertJsonPath('next_step', 'dashboard');

        $this->assertDatabaseHas('branches', [
            'name' => 'Lê Đức Thọ',
            'check_in_radius_meters' => 100,
        ]);
    }

    public function test_tenant_isolation_on_branches(): void
    {
        $a = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'vu@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH - Bánh tráng trộn',
        ])->json();

        $this->app['auth']->forgetGuards();

        $b = $this->postJson('/api/auth/register', [
            'name' => 'Nguyễn A',
            'email' => 'a@abc.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'ABC Coffee',
        ])->json();

        $this->app['auth']->forgetGuards();

        $this->withToken($a['access_token'])->postJson('/api/onboarding/organization', [
            'name' => 'FRESH - Bánh tráng trộn',
            'phone' => '0901111111',
            'address' => 'Addr A',
        ]);

        $this->app['auth']->forgetGuards();

        $branchA = $this->withToken($a['access_token'])->postJson('/api/onboarding/branch', [
            'name' => 'Lê Đức Thọ',
            'address' => 'Addr A',
            'check_in_radius_meters' => 100,
        ])->json('branch');

        $this->app['auth']->forgetGuards();

        $this->withToken($b['access_token'])->postJson('/api/onboarding/organization', [
            'name' => 'ABC Coffee',
            'phone' => '0902222222',
            'address' => 'Addr B',
        ]);

        $this->app['auth']->forgetGuards();

        $this->withToken($b['access_token'])->postJson('/api/onboarding/branch', [
            'name' => 'Quận 1',
            'address' => 'Addr B',
            'check_in_radius_meters' => 80,
        ])->assertCreated();

        $this->app['auth']->forgetGuards();

        // Tenant B không thấy / không truy cập được branch của A
        $this->withToken($b['access_token'])
            ->getJson('/api/branches')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.name', 'Quận 1');

        $this->app['auth']->forgetGuards();

        $this->withToken($b['access_token'])
            ->getJson('/api/branches/'.$branchA['id'])
            ->assertNotFound();
    }

    public function test_ignores_client_organization_id_query(): void
    {
        $a = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'vu@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH',
        ])->json();

        $b = $this->postJson('/api/auth/register', [
            'name' => 'Nguyễn A',
            'email' => 'a@abc.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'ABC Coffee',
        ])->json();

        $otherOrgId = $b['organization']['id'];

        $this->withToken($a['access_token'])
            ->getJson('/api/organization?organization_id='.$otherOrgId)
            ->assertOk()
            ->assertJsonPath('organization.id', $a['organization']['id'])
            ->assertJsonPath('organization.name', 'FRESH');
    }
}
