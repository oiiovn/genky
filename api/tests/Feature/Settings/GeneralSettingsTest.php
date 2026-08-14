<?php

namespace Tests\Feature\Settings;

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Services\Settings\GeneralSettingsService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class GeneralSettingsTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, org_id: int}
     */
    protected function seedOwner(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-general@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH General',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH General',
            'phone' => '0901111111',
            'address' => 'Gò Vấp',
            'tax_code' => '0312345678',
            'email' => 'hello@fresh.test',
            'website' => 'https://fresh.test',
        ]);
        $this->app['auth']->forgetGuards();

        return [
            'token' => $token,
            'org_id' => $register['organization']['id'],
        ];
    }

    public function test_guest_cannot_read_general_settings(): void
    {
        $this->getJson('/api/settings/general')->assertUnauthorized();
    }

    public function test_owner_gets_overview_defaults(): void
    {
        $ctx = $this->seedOwner();

        $this->withToken($ctx['token'])
            ->getJson('/api/settings/general')
            ->assertOk()
            ->assertJsonPath('can_manage', true)
            ->assertJsonPath('general.work_hours_per_day', 8)
            ->assertJsonPath('general.week_start', 'monday')
            ->assertJsonPath('general.date_format', 'd/m/Y')
            ->assertJsonPath('general.currency', 'VND')
            ->assertJsonPath('general.language', 'vi')
            ->assertJsonPath('company.name', 'FRESH General')
            ->assertJsonPath('company.tax_code', '0312345678')
            ->assertJsonPath('backup.last_at', null)
            ->assertJsonPath('system.server.ok', true)
            ->assertJsonPath('system.database.ok', true)
            ->assertJsonPath('users.total', 1)
            ->assertJsonPath('version.product', 'HRM Pro');
    }

    public function test_owner_can_update_and_persist_general_settings(): void
    {
        $ctx = $this->seedOwner();

        $payload = [
            'work_hours_per_day' => 9,
            'week_start' => 'sunday',
            'date_format' => 'Y-m-d',
            'currency' => 'USD',
            'language' => 'en',
        ];

        $this->withToken($ctx['token'])
            ->putJson('/api/settings/general', $payload)
            ->assertOk()
            ->assertJsonPath('general', $payload);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/settings/general')
            ->assertOk()
            ->assertJsonPath('general.work_hours_per_day', 9)
            ->assertJsonPath('general.language', 'en');

        $org = Organization::query()->find($ctx['org_id']);
        $this->assertSame('en', $org->locale);
        $this->assertSame('sunday', $org->settings['general']['week_start']);
    }

    public function test_invalid_payload_is_rejected(): void
    {
        $ctx = $this->seedOwner();

        $this->withToken($ctx['token'])
            ->putJson('/api/settings/general', [
                'work_hours_per_day' => 20,
                'week_start' => 'friday',
                'date_format' => 'iso',
                'currency' => 'EUR',
                'language' => 'fr',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors([
                'work_hours_per_day',
                'week_start',
                'date_format',
                'currency',
                'language',
            ]);
    }

    public function test_owner_can_create_backup(): void
    {
        Storage::fake('local');
        $ctx = $this->seedOwner();

        $this->withToken($ctx['token'])
            ->postJson('/api/settings/general/backup')
            ->assertOk()
            ->assertJsonPath('backup.size_bytes', fn ($v) => (int) $v > 0)
            ->assertJsonStructure(['backup' => ['last_at', 'last_label', 'size_bytes', 'size_label']]);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/settings/general')
            ->assertOk()
            ->assertJsonPath('backup.last_at', fn ($v) => is_string($v) && $v !== '');
    }

    public function test_employee_can_read_but_cannot_update_or_backup(): void
    {
        $ctx = $this->seedOwner();

        $staff = User::factory()->create([
            'email' => 'staff-general@fresh.test',
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
            'login' => 'staff-general@fresh.test',
            'password' => 'Password1!',
        ])->json();

        $this->app['auth']->forgetGuards();

        $this->withToken($login['access_token'])
            ->getJson('/api/settings/general')
            ->assertOk()
            ->assertJsonPath('can_manage', false)
            ->assertJsonPath('users.total', 2);

        $this->app['auth']->forgetGuards();

        $this->withToken($login['access_token'])
            ->putJson('/api/settings/general', GeneralSettingsService::DEFAULTS)
            ->assertForbidden();

        $this->app['auth']->forgetGuards();

        $this->withToken($login['access_token'])
            ->postJson('/api/settings/general/backup')
            ->assertForbidden();
    }

    public function test_tenant_isolation(): void
    {
        $a = $this->seedOwner();

        $this->withToken($a['token'])->putJson('/api/settings/general', [
            'work_hours_per_day' => 10,
            'week_start' => 'sunday',
            'date_format' => 'm/d/Y',
            'currency' => 'USD',
            'language' => 'en',
        ])->assertOk();

        $this->app['auth']->forgetGuards();

        $b = $this->postJson('/api/auth/register', [
            'name' => 'Nguyễn A',
            'email' => 'other-general@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'ABC General',
        ])->json();

        $this->app['auth']->forgetGuards();

        $this->withToken($b['access_token'])
            ->getJson('/api/settings/general?organization_id='.$a['org_id'])
            ->assertOk()
            ->assertJsonPath('general.work_hours_per_day', 8)
            ->assertJsonPath('general.language', 'vi')
            ->assertJsonPath('company.name', 'ABC General');
    }
}
