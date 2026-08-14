<?php

namespace Tests\Feature\Settings;

use App\Models\OrganizationUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserPreferencesTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string}
     */
    protected function seedOwner(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-pref@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH Pref',
        ])->json();

        $this->app['auth']->forgetGuards();

        return ['token' => $register['access_token']];
    }

    public function test_guest_cannot_read_preferences(): void
    {
        $this->getJson('/api/me/preferences')->assertUnauthorized();
    }

    public function test_owner_gets_defaults_when_unset(): void
    {
        $ctx = $this->seedOwner();

        $this->withToken($ctx['token'])
            ->getJson('/api/me/preferences')
            ->assertOk()
            ->assertJsonPath('preferences.sidebar_style', null);
    }

    public function test_user_can_update_and_persist_sidebar(): void
    {
        $ctx = $this->seedOwner();

        $this->withToken($ctx['token'])
            ->patchJson('/api/me/preferences', [
                'sidebar_style' => 'collapsed',
            ])
            ->assertOk()
            ->assertJsonPath('preferences.sidebar_style', 'collapsed');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/me/preferences')
            ->assertOk()
            ->assertJsonPath('preferences.sidebar_style', 'collapsed');
    }

    public function test_toggle_flips_sidebar_style(): void
    {
        $ctx = $this->seedOwner();

        $this->withToken($ctx['token'])
            ->postJson('/api/me/preferences/sidebar/toggle')
            ->assertOk()
            ->assertJsonPath('preferences.sidebar_style', 'collapsed');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->postJson('/api/me/preferences/sidebar/toggle')
            ->assertOk()
            ->assertJsonPath('preferences.sidebar_style', 'expanded');
    }

    public function test_invalid_payload_is_rejected(): void
    {
        $ctx = $this->seedOwner();

        $this->withToken($ctx['token'])
            ->patchJson('/api/me/preferences', [
                'sidebar_style' => 'wide',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['sidebar_style']);
    }

    public function test_employee_can_toggle_own_sidebar(): void
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-pref-staff@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH Pref Staff',
        ])->json();

        $this->app['auth']->forgetGuards();

        $staff = User::factory()->create([
            'email' => 'staff-pref@fresh.test',
            'password' => 'Password1!',
        ]);

        OrganizationUser::query()->create([
            'organization_id' => $register['organization']['id'],
            'user_id' => $staff->id,
            'role' => OrganizationUser::ROLE_EMPLOYEE,
            'is_default' => true,
        ]);

        $staff->forceFill(['current_organization_id' => $register['organization']['id']])->save();

        $login = $this->postJson('/api/auth/login', [
            'login' => 'staff-pref@fresh.test',
            'password' => 'Password1!',
        ])->json();

        $this->app['auth']->forgetGuards();

        $this->withToken($login['access_token'])
            ->postJson('/api/me/preferences/sidebar/toggle')
            ->assertOk()
            ->assertJsonPath('preferences.sidebar_style', 'collapsed');
    }

    public function test_preferences_are_isolated_per_user(): void
    {
        $a = $this->seedOwner();

        $this->withToken($a['token'])
            ->patchJson('/api/me/preferences', [
                'sidebar_style' => 'collapsed',
            ])
            ->assertOk();

        $this->app['auth']->forgetGuards();

        $b = $this->postJson('/api/auth/register', [
            'name' => 'Nguyễn A',
            'email' => 'other-pref@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'ABC Pref',
        ])->json();

        $this->app['auth']->forgetGuards();

        $this->withToken($b['access_token'])
            ->getJson('/api/me/preferences')
            ->assertOk()
            ->assertJsonPath('preferences.sidebar_style', null);
    }

    public function test_me_includes_preferences(): void
    {
        $ctx = $this->seedOwner();

        $this->withToken($ctx['token'])
            ->patchJson('/api/me/preferences', [
                'sidebar_style' => 'collapsed',
            ])
            ->assertOk();

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('preferences.sidebar_style', 'collapsed');
    }
}
