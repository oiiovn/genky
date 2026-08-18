<?php

namespace Tests\Feature\Marketing;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MarketingReviewOverviewDailyTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, branch_id: int, shopee_food_id: int, grab_food_id: int}
     */
    protected function seedShop(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-daily@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH DAILY',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH DAILY',
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

        $channels = collect($meta['channels']);
        $shopeeFood = $channels->first(
            fn ($c) => strtolower((string) $c['code']) === 'shopeefood'
        );
        $grabFood = $channels->first(
            fn ($c) => strtolower((string) $c['code']) === 'grabfood'
        );

        $this->assertNotNull($shopeeFood);
        $this->assertNotNull($grabFood);

        return [
            'token' => $token,
            'branch_id' => (int) $branch['id'],
            'shopee_food_id' => (int) $shopeeFood['id'],
            'grab_food_id' => (int) $grabFood['id'],
        ];
    }

    public function test_overview_daily_series_splits_by_channel(): void
    {
        $ctx = $this->seedShop();

        $this->withToken($ctx['token'])
            ->postJson('/api/marketing/reviews', [
                'branch_id' => $ctx['branch_id'],
                'channel_id' => $ctx['shopee_food_id'],
                'order_code' => '#08086-443874188',
                'rating' => 5,
                'reviewed_at' => '2026-08-16 10:00:00',
            ])
            ->assertCreated();
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->postJson('/api/marketing/reviews', [
                'branch_id' => $ctx['branch_id'],
                'channel_id' => $ctx['shopee_food_id'],
                'order_code' => '#08086-443874189',
                'rating' => 5,
                'reviewed_at' => '2026-08-16 18:00:00',
            ])
            ->assertCreated();
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->postJson('/api/marketing/reviews', [
                'branch_id' => $ctx['branch_id'],
                'channel_id' => $ctx['grab_food_id'],
                'order_code' => 'GF-888',
                'rating' => 5,
                'reviewed_at' => '2026-08-17 09:00:00',
            ])
            ->assertCreated();
        $this->app['auth']->forgetGuards();

        $data = $this->withToken($ctx['token'])
            ->getJson('/api/marketing/reviews/overview?from=2026-08-16&to=2026-08-17')
            ->assertOk()
            ->json('data');

        $channelIds = collect($data['dailyChannels'])->pluck('id')->all();
        $this->assertContains('shopee_food', $channelIds);
        $this->assertContains('grab_food', $channelIds);

        $byDate = collect($data['daily'])->keyBy('date');

        $aug16 = $byDate->get('2026-08-16');
        $this->assertSame(2, $aug16['count']);
        $this->assertSame(2, $aug16['byChannel']['shopee_food']);
        $this->assertArrayNotHasKey('grab_food', $aug16['byChannel']);

        $aug17 = $byDate->get('2026-08-17');
        $this->assertSame(1, $aug17['count']);
        $this->assertSame(1, $aug17['byChannel']['grab_food']);
        $this->assertArrayNotHasKey('shopee_food', $aug17['byChannel']);
    }
}
