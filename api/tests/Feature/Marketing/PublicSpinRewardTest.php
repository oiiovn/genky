<?php

namespace Tests\Feature\Marketing;

use App\Models\MarketingRewardCode;
use App\Models\Organization;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class PublicSpinRewardTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, org_id: int, branch_id: int, channel_id: int}
     */
    protected function seedShop(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-spin@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH SPIN',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH SPIN',
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

    public function test_spin_rewards_when_review_uploaded(): void
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

        $this->assertTrue($spin['success']);
        $this->assertFalse($spin['already_issued']);
        $this->assertFalse($spin['provisional']);
        $this->assertNotEmpty($spin['reward']['name']);
        $this->assertNotEmpty($spin['reward']['code']);

        $again = $this->postJson('/api/public/review-reward/spin', [
            'org_id' => $ctx['org_id'],
            'order_code' => '08086-443874188',
        ])->assertOk()->json();

        $this->assertTrue($again['already_issued']);
        $this->assertSame($spin['reward']['code'], $again['reward']['code']);
    }

    public function test_spin_returns_customer_display_value(): void
    {
        $ctx = $this->seedShop();

        $rewards = $this->withToken($ctx['token'])
            ->getJson('/api/marketing/rewards')
            ->assertOk()
            ->json('data');
        $this->app['auth']->forgetGuards();

        $this->assertNotEmpty($rewards);

        foreach ($rewards as $i => $row) {
            $this->withToken($ctx['token'])
                ->putJson('/api/marketing/rewards/'.$row['id'], [
                    'enabled' => $i === 0,
                    'display_value' => $i === 0 ? 99000 : (int) $row['value'],
                ])
                ->assertOk();
            $this->app['auth']->forgetGuards();
        }

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

        $this->assertSame(99000, $spin['reward']['display_value']);
    }

    public function test_spin_rejects_invalid_format(): void
    {
        $ctx = $this->seedShop();

        $this->postJson('/api/public/review-reward/spin', [
            'org_id' => $ctx['org_id'],
            'order_code' => 'abc123',
        ])->assertStatus(422);
    }

    public function test_spin_accepts_grabfood_order_format(): void
    {
        $ctx = $this->seedShop();

        $this->withToken($ctx['token'])
            ->putJson('/api/marketing/reward-code-settings', [
                'reward_before_review' => true,
                'expiry_type' => 'DAYS',
                'expiry_days' => 7,
            ])
            ->assertOk();
        $this->app['auth']->forgetGuards();

        $spin = $this->postJson('/api/public/review-reward/spin', [
            'org_id' => $ctx['org_id'],
            'order_code' => 'gf-888',
        ])->assertOk()->json();

        $this->assertTrue($spin['success']);
        $this->assertNotEmpty($spin['reward']['code']);

        $again = $this->postJson('/api/public/review-reward/spin', [
            'org_id' => $ctx['org_id'],
            'order_code' => 'GF-888',
        ])->assertOk()->json();

        $this->assertTrue($again['already_issued']);
        $this->assertSame($spin['reward']['code'], $again['reward']['code']);
    }

    public function test_reward_before_review_then_reconcile_cancels_without_review(): void
    {
        $ctx = $this->seedShop();

        $this->withToken($ctx['token'])
            ->putJson('/api/marketing/reward-code-settings', [
                'reward_before_review' => true,
                'expiry_type' => 'DAYS',
                'expiry_days' => 7,
            ])
            ->assertOk();
        $this->app['auth']->forgetGuards();

        $spin = $this->postJson('/api/public/review-reward/spin', [
            'org_id' => $ctx['org_id'],
            'order_code' => '#08086-443874188',
        ])->assertOk()->json();

        $this->assertTrue($spin['provisional']);
        $code = $spin['reward']['code'];

        $check = $this->withToken($ctx['token'])
            ->postJson('/api/marketing/reward-codes/check', ['code' => $code])
            ->assertOk()
            ->json('data');
        $this->app['auth']->forgetGuards();
        $this->assertTrue($check['missing_review']);
        $this->assertSame(
            'Phát hiện chưa có đánh giá, kiểm tra ngay',
            $check['missing_review_message'],
        );

        Carbon::setTestNow(now()->addHours(49));
        Artisan::call('marketing:reconcile-provisional-rewards');
        Carbon::setTestNow();

        $this->assertDatabaseHas('marketing_reward_codes', [
            'code' => $code,
            'status' => MarketingRewardCode::STATUS_CANCELLED,
        ]);
    }

    public function test_reward_before_review_then_reconcile_keeps_when_review_uploaded(): void
    {
        $ctx = $this->seedShop();

        $this->withToken($ctx['token'])
            ->putJson('/api/marketing/reward-code-settings', [
                'reward_before_review' => true,
                'expiry_type' => 'DAYS',
                'expiry_days' => 7,
            ])
            ->assertOk();
        $this->app['auth']->forgetGuards();

        $spin = $this->postJson('/api/public/review-reward/spin', [
            'org_id' => $ctx['org_id'],
            'order_code' => '#09086-111222333',
        ])->assertOk()->json();

        $this->assertTrue($spin['provisional']);
        $code = $spin['reward']['code'];

        $this->withToken($ctx['token'])
            ->postJson('/api/marketing/reviews', [
                'branch_id' => $ctx['branch_id'],
                'channel_id' => $ctx['channel_id'],
                'order_code' => '#09086-111222333',
                'rating' => 5,
            ])
            ->assertCreated();
        $this->app['auth']->forgetGuards();

        $check = $this->withToken($ctx['token'])
            ->postJson('/api/marketing/reward-codes/check', ['code' => $code])
            ->assertOk()
            ->json('data');
        $this->app['auth']->forgetGuards();
        $this->assertFalse($check['missing_review']);

        Carbon::setTestNow(now()->addHours(49));
        Artisan::call('marketing:reconcile-provisional-rewards');
        Carbon::setTestNow();

        $row = MarketingRewardCode::withoutGlobalScopes()->where('code', $code)->first();
        $this->assertNotNull($row);
        $this->assertSame(MarketingRewardCode::STATUS_ISSUED, $row->status);
        $this->assertFalse((bool) $row->provisional);
        $this->assertNotNull($row->review_id);
    }

    public function test_existing_active_code_without_reward_rebinds_enabled_gift(): void
    {
        $ctx = $this->seedShop();

        $rewards = $this->withToken($ctx['token'])
            ->getJson('/api/marketing/rewards')
            ->assertOk()
            ->json('data');
        $this->app['auth']->forgetGuards();

        $this->assertGreaterThanOrEqual(2, count($rewards));

        $this->withToken($ctx['token'])
            ->postJson('/api/marketing/reviews', [
                'branch_id' => $ctx['branch_id'],
                'channel_id' => $ctx['channel_id'],
                'order_code' => '#08086-443874188',
                'rating' => 5,
            ])
            ->assertCreated();
        $this->app['auth']->forgetGuards();

        $first = $this->postJson('/api/public/review-reward/spin', [
            'org_id' => $ctx['org_id'],
            'order_code' => '#08086-443874188',
        ])->assertOk()->json();

        $code = (string) $first['reward']['code'];
        $row = MarketingRewardCode::withoutGlobalScopes()->where('code', $code)->firstOrFail();
        $oldRewardId = (int) $row->reward_id;

        $replacement = collect($rewards)->first(
            fn ($reward) => (int) $reward['id'] !== $oldRewardId
        );
        $this->assertNotNull($replacement);

        $this->withToken($ctx['token'])
            ->deleteJson('/api/marketing/rewards/'.$oldRewardId)
            ->assertOk();
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->putJson('/api/marketing/rewards/'.$replacement['id'], [
                'enabled' => true,
            ])
            ->assertOk();
        $this->app['auth']->forgetGuards();

        $again = $this->postJson('/api/public/review-reward/spin', [
            'org_id' => $ctx['org_id'],
            'order_code' => '#08086-443874188',
        ])->assertOk()->json();

        $this->assertTrue($again['already_issued']);
        $this->assertSame((string) $replacement['name'], $again['reward']['name']);
        $this->assertNotSame('Quà tặng', $again['reward']['name']);
    }

    public function test_without_before_review_requires_uploaded_review(): void
    {
        $ctx = $this->seedShop();

        $this->postJson('/api/public/review-reward/spin', [
            'org_id' => $ctx['org_id'],
            'order_code' => '#08086-443874188',
        ])->assertStatus(422);
    }
}
