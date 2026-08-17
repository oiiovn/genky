<?php

namespace Tests\Feature\Attendance;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AttendanceQrTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, branch_id: int}
     */
    protected function seedOwnerWithBranch(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-qr@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH QR',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH QR',
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
            'branch_id' => $branch['id'],
        ];
    }

    public function test_owner_can_get_default_qr_settings_for_branch(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $this->withToken($ctx['token'])
            ->getJson('/api/attendances/qr/settings?branch_id='.$ctx['branch_id'])
            ->assertOk()
            ->assertJsonPath('data.branch_id', $ctx['branch_id'])
            ->assertJsonPath('data.enabled', true)
            ->assertJsonPath('data.rotate_seconds', 30)
            ->assertJsonPath('data.allow_check_in', true);
    }

    public function test_owner_can_update_settings_and_get_current_qr(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $this->withToken($ctx['token'])
            ->putJson('/api/attendances/qr/settings', [
                'branch_id' => $ctx['branch_id'],
                'enabled' => true,
                'rotate_seconds' => 45,
                'valid_from' => '06:00',
                'valid_to' => '22:00',
                'allow_check_in' => true,
                'allow_check_out' => false,
            ])
            ->assertOk()
            ->assertJsonPath('data.rotate_seconds', 45)
            ->assertJsonPath('data.allow_check_out', false);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/attendances/qr/current?branch_id='.$ctx['branch_id'])
            ->assertOk()
            ->assertJsonPath('data.branch.id', $ctx['branch_id'])
            ->assertJsonPath('data.rotate_seconds', 45)
            ->assertJsonStructure([
                'data' => [
                    'expires_in',
                    'qr_value',
                    'payload' => ['token', 'slot', 'branch_id', 'org_id'],
                ],
            ]);
    }

    public function test_scan_qr_check_in_and_check_out(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Văn Minh',
            'email' => 'minh-qr@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
        ])->json('data');
        $this->app['auth']->forgetGuards();

        $current = $this->withToken($ctx['token'])
            ->getJson('/api/attendances/qr/current?branch_id='.$ctx['branch_id'])
            ->assertOk()
            ->json('data');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->postJson('/api/attendances/qr/scan', [
                'employee_id' => $employee['id'],
                'branch_id' => $ctx['branch_id'],
                'slot' => $current['payload']['slot'],
                'token' => $current['payload']['token'],
                'action' => 'auto',
            ])
            ->assertCreated()
            ->assertJsonPath('action', 'check_in');

        $this->app['auth']->forgetGuards();
        $this->travel(6)->minutes();

        $current2 = $this->withToken($ctx['token'])
            ->getJson('/api/attendances/qr/current?branch_id='.$ctx['branch_id'])
            ->json('data');
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->postJson('/api/attendances/qr/scan', [
                'employee_id' => $employee['id'],
                'branch_id' => $ctx['branch_id'],
                'slot' => $current2['payload']['slot'],
                'token' => $current2['payload']['token'],
                'action' => 'auto',
            ])
            ->assertOk()
            ->assertJsonPath('action', 'check_out');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/attendances/qr/recent?branch_id='.$ctx['branch_id'])
            ->assertOk()
            ->assertJsonStructure(['data' => [['full_name', 'action', 'time', 'ok']]]);
    }

    public function test_second_branch_has_isolated_settings(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $other = $this->withToken($ctx['token'])->postJson('/api/branches', [
            'name' => 'Tân Bình',
            'address' => '456 Cộng Hòa',
            'check_in_radius_meters' => 80,
        ])->json('branch');
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->putJson('/api/attendances/qr/settings', [
            'branch_id' => $ctx['branch_id'],
            'enabled' => true,
            'rotate_seconds' => 60,
            'valid_from' => '00:00',
            'valid_to' => '23:59',
            'allow_check_in' => true,
            'allow_check_out' => true,
        ])->assertOk();
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/attendances/qr/settings?branch_id='.$other['id'])
            ->assertOk()
            ->assertJsonPath('data.branch_id', $other['id'])
            ->assertJsonPath('data.rotate_seconds', 30);
    }
}
