<?php

namespace Tests\Feature\Settings;

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Services\Settings\InterfaceSettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class InterfaceSettingsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, org_id: int}
     */
    protected function seedOwner(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-ui@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH UI',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH UI',
            'phone' => '0901111111',
            'address' => 'Gò Vấp',
        ]);
        $this->app['auth']->forgetGuards();

        return [
            'token' => $token,
            'org_id' => $register['organization']['id'],
        ];
    }

    public function test_guest_cannot_read_interface_settings(): void
    {
        $this->getJson('/api/settings/interface')->assertUnauthorized();
    }

    public function test_owner_gets_defaults_when_unset(): void
    {
        $ctx = $this->seedOwner();

        $this->withToken($ctx['token'])
            ->getJson('/api/settings/interface')
            ->assertOk()
            ->assertJsonPath('interface.theme_preset', 'purple')
            ->assertJsonPath('interface.primary_color', '#111827')
            ->assertJsonPath('interface.secondary_color', '#F3F4F6')
            ->assertJsonPath('interface.display_mode', 'light')
            ->assertJsonPath('interface.sidebar_style', 'expanded')
            ->assertJsonPath('interface.rounded_corners', true)
            ->assertJsonPath('interface.animations_enabled', true);
    }

    public function test_owner_can_update_and_persist_interface_settings(): void
    {
        $ctx = $this->seedOwner();

        $payload = [
            'theme_preset' => 'orange',
            'primary_color' => '#f59e0b',
            'secondary_color' => '#fffbeb',
            'display_mode' => 'light',
            'sidebar_style' => 'expanded',
            'rounded_corners' => true,
            'animations_enabled' => true,
        ];

        $this->withToken($ctx['token'])
            ->putJson('/api/settings/interface', $payload)
            ->assertOk()
            ->assertJsonPath('interface.theme_preset', 'orange')
            ->assertJsonPath('interface.primary_color', '#F59E0B')
            ->assertJsonPath('interface.secondary_color', '#FFFBEB');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/settings/interface')
            ->assertOk()
            ->assertJsonPath('interface.theme_preset', 'orange')
            ->assertJsonPath('interface.primary_color', '#F59E0B');

        $org = Organization::query()->find($ctx['org_id']);
        $this->assertSame('orange', $org->settings['interface']['theme_preset']);
    }

    public function test_reset_restores_defaults(): void
    {
        $ctx = $this->seedOwner();

        $this->withToken($ctx['token'])->putJson('/api/settings/interface', [
            'theme_preset' => 'pink',
            'primary_color' => '#EC4899',
            'secondary_color' => '#FDF2F8',
            'display_mode' => 'dark',
            'sidebar_style' => 'collapsed',
            'rounded_corners' => false,
            'animations_enabled' => false,
        ])->assertOk();

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->postJson('/api/settings/interface/reset')
            ->assertOk()
            ->assertJsonPath('interface', InterfaceSettingsService::DEFAULTS);
    }

    public function test_invalid_payload_is_rejected(): void
    {
        $ctx = $this->seedOwner();

        $this->withToken($ctx['token'])
            ->putJson('/api/settings/interface', [
                'theme_preset' => 'neon',
                'primary_color' => 'orange',
                'secondary_color' => '#FFF',
                'display_mode' => 'system',
                'sidebar_style' => 'wide',
                'rounded_corners' => 'yes',
                'animations_enabled' => 'yes',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'theme_preset',
                'primary_color',
                'secondary_color',
                'display_mode',
                'sidebar_style',
                'rounded_corners',
                'animations_enabled',
            ]);
    }

    public function test_tenant_isolation(): void
    {
        $a = $this->seedOwner();

        $this->withToken($a['token'])->putJson('/api/settings/interface', [
            'theme_preset' => 'green',
            'primary_color' => '#22C55E',
            'secondary_color' => '#ECFDF5',
            'display_mode' => 'dark',
            'sidebar_style' => 'collapsed',
            'rounded_corners' => false,
            'animations_enabled' => false,
        ])->assertOk();

        $this->app['auth']->forgetGuards();

        $b = $this->postJson('/api/auth/register', [
            'name' => 'Nguyễn A',
            'email' => 'other-ui@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'ABC Coffee',
        ])->json();

        $this->app['auth']->forgetGuards();

        $this->withToken($b['access_token'])
            ->getJson('/api/settings/interface?organization_id='.$a['org_id'])
            ->assertOk()
            ->assertJsonPath('interface.theme_preset', 'purple')
            ->assertJsonPath('interface.display_mode', 'light');
    }

    public function test_employee_can_read_but_cannot_update(): void
    {
        $ctx = $this->seedOwner();

        $staff = User::factory()->create([
            'email' => 'staff-ui@fresh.test',
            'password' => 'Password1!',
        ]);

        OrganizationUser::query()->create([
            'organization_id' => $ctx['org_id'],
            'user_id' => $staff->id,
            'role' => OrganizationUser::ROLE_EMPLOYEE,
            'is_default' => true,
        ]);

        $staff->forceFill(['current_organization_id' => $ctx['org_id']])->save();

        $login = $this->postJson('/api/auth/login', [
            'login' => 'staff-ui@fresh.test',
            'password' => 'Password1!',
        ])->json();

        $this->app['auth']->forgetGuards();

        $this->withToken($login['access_token'])
            ->getJson('/api/settings/interface')
            ->assertOk()
            ->assertJsonPath('interface.theme_preset', 'purple');

        $this->app['auth']->forgetGuards();

        $this->withToken($login['access_token'])
            ->putJson('/api/settings/interface', InterfaceSettingsService::DEFAULTS)
            ->assertForbidden();
    }
}
