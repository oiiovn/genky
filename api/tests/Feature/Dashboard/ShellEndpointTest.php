<?php

namespace Tests\Feature\Dashboard;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ShellEndpointTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string}
     */
    protected function seedOwnerWithBranch(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-shell@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH Shell',
        ])->json();

        $token = $register['access_token'];

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH Shell',
            'phone' => '0901111111',
            'address' => 'Gò Vấp',
        ]);

        $this->app['auth']->forgetGuards();
        $this->withToken($token)->postJson('/api/onboarding/branch', [
            'name' => 'Lê Đức Thọ',
            'address' => '123 Lê Đức Thọ',
            'check_in_radius_meters' => 100,
        ]);

        $this->app['auth']->forgetGuards();

        return ['token' => $token];
    }

    public function test_shell_returns_chrome_without_dashboard_payload(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $this->withToken($ctx['token'])
            ->getJson('/api/shell')
            ->assertOk()
            ->assertJsonPath('tenant.name', 'FRESH Shell')
            ->assertJsonPath('branch.name', 'Chi nhánh Lê Đức Thọ')
            ->assertJsonPath('greeting.name', 'Vũ')
            ->assertJsonStructure([
                'greeting',
                'role',
                'role_label',
                'access',
                'tenant',
                'branch',
                'branches',
                'date',
                'notification_count',
                'notifications',
                'pending_leaves',
            ])
            ->assertJsonMissingPath('kpis')
            ->assertJsonMissingPath('attendance_today')
            ->assertJsonMissingPath('salary_projection')
            ->assertJsonMissingPath('personnel_costs')
            ->assertJsonMissingPath('upcoming_shifts');
    }

    public function test_guest_cannot_read_shell(): void
    {
        $this->getJson('/api/shell')->assertUnauthorized();
    }
}
