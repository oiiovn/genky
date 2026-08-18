<?php

namespace Tests\Feature\Marketing;

use App\Models\Organization;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MarketingRewardCodeSettingTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, org_id: int}
     */
    protected function seedShop(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-codefmt@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH CODE',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH CODE',
            'phone' => '0901111111',
            'address' => 'Gò Vấp',
        ]);
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/branch', [
            'name' => 'Lê Văn Quới',
            'address' => '123 Lê Văn Quới',
            'check_in_radius_meters' => 100,
        ]);
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->getJson('/api/marketing/reviews/form-meta')->assertOk();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/marketing/rewards/seed-defaults')->assertOk();
        $this->app['auth']->forgetGuards();

        return [
            'token' => $token,
            'org_id' => (int) Organization::query()->orderByDesc('id')->value('id'),
        ];
    }

    public function test_pattern_is_persisted_and_xxxx_codes_are_issued(): void
    {
        $ctx = $this->seedShop();

        $saved = $this->withToken($ctx['token'])
            ->putJson('/api/marketing/reward-code-settings', [
                'pattern' => 'XXXX-XXXX',
                'reward_before_review' => true,
                'expiry_type' => 'DAYS',
                'expiry_days' => 7,
            ])
            ->assertOk()
            ->json('data');
        $this->app['auth']->forgetGuards();

        $this->assertSame('XXXX-XXXX', $saved['pattern']);
        $this->assertSame('', $saved['prefix']);
        $this->assertSame(8, $saved['length']);

        $spin = $this->postJson('/api/public/review-reward/spin', [
            'org_id' => $ctx['org_id'],
            'order_code' => 'GF-888',
        ])->assertOk()->json();

        $this->assertMatchesRegularExpression('/^[A-Z0-9]{4}-[A-Z0-9]{4}$/', $spin['reward']['code']);
        $this->assertDoesNotMatchRegularExpression('/^GEN-/', $spin['reward']['code']);
    }
}
