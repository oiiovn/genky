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

    public function test_feature_map_stays_correct_after_override_and_repeat_read(): void
    {
        $ctx = $this->registerReadyOrg();

        $first = collect(
            $this->withToken($ctx['token'])->getJson('/api/features')->json('features')
        )->pluck('enabled', 'code');
        $this->assertTrue($first[Feature::EMPLOYEES]);

        $this->app['auth']->forgetGuards();

        $second = collect(
            $this->withToken($ctx['token'])->getJson('/api/features')->json('features')
        )->pluck('enabled', 'code');
        $this->assertTrue($second[Feature::EMPLOYEES]);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/features/organization', [
            'feature' => Feature::EMPLOYEES,
            'enabled' => false,
        ])->assertOk();

        $this->app['auth']->forgetGuards();

        $after = collect(
            $this->withToken($ctx['token'])->getJson('/api/features')->json('features')
        )->pluck('enabled', 'code');
        $this->assertFalse($after[Feature::EMPLOYEES]);
    }

    public function test_me_includes_entitlements(): void
    {
        $ctx = $this->registerReadyOrg();

        $me = $this->withToken($ctx['token'])
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonStructure([
                'entitlements' => [
                    'plan' => ['code', 'name'],
                    'features',
                ],
            ])
            ->json();

        $this->app['auth']->forgetGuards();
        $catalog = $this->withToken($ctx['token'])
            ->getJson('/api/features')
            ->assertOk()
            ->json();

        $this->assertSame($catalog['plan']['code'], $me['entitlements']['plan']['code']);
        $this->assertSame(
            collect($catalog['features'])->pluck('source', 'code')->all(),
            collect($me['entitlements']['features'])->pluck('source', 'code')->all(),
        );
        $this->assertContains('plan', collect($me['entitlements']['features'])->pluck('source')->all());
    }

    public function test_catalog_source_uses_overrides_without_per_feature_lookup(): void
    {
        $ctx = $this->registerReadyOrg();

        $this->withToken($ctx['token'])->postJson('/api/features/organization', [
            'feature' => Feature::POS,
            'enabled' => true,
            'source' => 'addon',
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $this->withToken($ctx['token'])->postJson('/api/features/branches/'.$ctx['branch_id'], [
            'feature' => Feature::EMPLOYEES,
            'enabled' => false,
        ])->assertOk();

        $this->app['auth']->forgetGuards();
        $features = collect(
            $this->withToken($ctx['token'])
                ->withHeader('X-Branch-Id', (string) $ctx['branch_id'])
                ->getJson('/api/me')
                ->assertOk()
                ->json('entitlements.features')
        )->keyBy('code');

        $this->assertSame('branch', $features[Feature::EMPLOYEES]['source']);
        $this->assertFalse($features[Feature::EMPLOYEES]['enabled']);
        $this->assertSame('addon', $features[Feature::POS]['source']);
        $this->assertTrue($features[Feature::POS]['enabled']);
    }
}
