<?php

namespace Tests\Feature\Feature;

use App\Models\Feature;
use App\Models\Plan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FeatureEntitlementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\FeaturePlanSeeder::class);
    }

    /**
     * @return array{token: string, branch_id: int}
     */
    protected function registerReadyOrg(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-feat@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH Feature',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH Feature',
            'phone' => '0901111111',
            'address' => 'GV',
        ]);
        $this->app['auth']->forgetGuards();

        $branch = $this->withToken($token)->postJson('/api/onboarding/branch', [
            'name' => 'Lê Đức Thọ',
            'address' => 'LDT',
        ])->json('branch');

        $this->app['auth']->forgetGuards();

        return ['token' => $token, 'branch_id' => $branch['id']];
    }

    public function test_free_plan_has_core_hrm_features(): void
    {
        $ctx = $this->registerReadyOrg();

        $features = $this->withToken($ctx['token'])
            ->getJson('/api/features')
            ->assertOk()
            ->assertJsonPath('plan.code', Plan::FREE)
            ->json('features');

        $map = collect($features)->pluck('enabled', 'code');

        $this->assertTrue($map[Feature::EMPLOYEES]);
        $this->assertTrue($map[Feature::ATTENDANCE]);
        $this->assertTrue($map[Feature::TIMESHEET]);
        $this->assertTrue($map[Feature::PAYROLL]);
        $this->assertFalse($map[Feature::POS]);
    }

    public function test_branch_can_override_feature_off(): void
    {
        $ctx = $this->registerReadyOrg();

        $this->withToken($ctx['token'])->postJson('/api/features/branches/'.$ctx['branch_id'], [
            'feature' => Feature::EMPLOYEES,
            'enabled' => false,
        ])->assertOk();

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->withHeader('X-Branch-Id', (string) $ctx['branch_id'])
            ->getJson('/api/employees')
            ->assertForbidden()
            ->assertJsonPath('code', 'FEATURE_NOT_ENABLED');
    }

    public function test_org_can_enable_addon_beyond_plan(): void
    {
        $ctx = $this->registerReadyOrg();

        $this->withToken($ctx['token'])->postJson('/api/features/organization', [
            'feature' => Feature::POS,
            'enabled' => true,
            'source' => 'addon',
        ])->assertOk();

        $this->app['auth']->forgetGuards();

        $map = collect(
            $this->withToken($ctx['token'])->getJson('/api/features')->json('features')
        )->pluck('enabled', 'code');

        $this->assertTrue($map[Feature::POS]);
    }

    public function test_me_includes_entitlements(): void
    {
        $ctx = $this->registerReadyOrg();

        $this->withToken($ctx['token'])
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonStructure([
                'entitlements' => [
                    'plan' => ['code', 'name'],
                    'features',
                ],
            ]);
    }
}
