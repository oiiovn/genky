<?php

namespace Tests\Feature\Marketing;

use App\Models\MarketingRewardCode;
use App\Models\Organization;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MarketingRewardDeleteTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, org_id: int, branch_id: int, channel_id: int}
     */
    protected function seedShop(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-reward-del@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH DEL',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH DEL',
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

        $meta = $this->withToken($token)
            ->getJson('/api/marketing/reviews/form-meta')
            ->assertOk()
            ->json('data');
        $this->app['auth']->forgetGuards();

        $this->withToken($token)
            ->postJson('/api/marketing/rewards/seed-defaults')
            ->assertOk();
        $this->app['auth']->forgetGuards();

        return [
            'token' => $token,
            'org_id' => (int) Organization::query()->orderByDesc('id')->value('id'),
            'branch_id' => (int) $branch['id'],
            'channel_id' => (int) $meta['channels'][0]['id'],
        ];
    }

    public function test_can_delete_reward_that_already_has_codes(): void
    {
        $ctx = $this->seedShop();

        $this->withToken($ctx['token'])
            ->postJson('/api/marketing/reviews', [
                'branch_id' => $ctx['branch_id'],
                'channel_id' => $ctx['channel_id'],
                'order_code' => '#08086-443874188',
                'rating' => 5,
            ])
            ->assertCreated();
        $this->app['auth']->forgetGuards();

        $spin = $this->postJson('/api/public/review-reward/spin', [
            'org_id' => $ctx['org_id'],
            'order_code' => '#08086-443874188',
        ])->assertOk()->json();

        $code = (string) $spin['reward']['code'];
        $row = MarketingRewardCode::withoutGlobalScopes()
            ->where('code', $code)
            ->firstOrFail();
        $rewardId = (int) $row->reward_id;

        $this->withToken($ctx['token'])
            ->deleteJson('/api/marketing/rewards/'.$rewardId)
            ->assertOk()
            ->assertJsonPath('message', 'Đã xoá món tặng.');

        $this->assertDatabaseMissing('marketing_rewards', ['id' => $rewardId]);
        $this->assertTrue(
            MarketingRewardCode::withoutGlobalScopes()
                ->where('code', $code)
                ->whereNull('reward_id')
                ->exists()
        );
    }
}
