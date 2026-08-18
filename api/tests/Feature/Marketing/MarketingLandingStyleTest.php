<?php

namespace Tests\Feature\Marketing;

use App\Models\MarketingQrCode;
use App\Models\Organization;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MarketingLandingStyleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, org_id: int}
     */
    protected function seedOwner(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-landing@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH LANDING',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH LANDING',
            'phone' => '0901111111',
            'address' => 'Gò Vấp',
        ]);
        $this->app['auth']->forgetGuards();

        return [
            'token' => $token,
            'org_id' => (int) Organization::query()->orderByDesc('id')->value('id'),
        ];
    }

    public function test_saved_order_links_show_on_public_landing(): void
    {
        $ctx = $this->seedOwner();

        $this->withToken($ctx['token'])
            ->putJson('/api/marketing/landing', [
                'style' => ['primary' => '#FF6D00'],
                'landing' => [
                    'shopName' => 'FRESH',
                    'shopeeFoodUrl' => 'https://shopeefood.vn/fresh',
                    'grabFoodUrl' => 'https://food.grab.com/fresh',
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.landing.shopeeFoodUrl', 'https://shopeefood.vn/fresh')
            ->assertJsonPath('data.landing.grabFoodUrl', 'https://food.grab.com/fresh');
        $this->app['auth']->forgetGuards();

        $this->getJson('/api/public/review-reward/landing?org_id='.$ctx['org_id'])
            ->assertOk()
            ->assertJsonPath('data.landing.shopeeFoodUrl', 'https://shopeefood.vn/fresh')
            ->assertJsonPath('data.landing.grabFoodUrl', 'https://food.grab.com/fresh')
            ->assertJsonPath('data.landing.shopName', 'FRESH');
    }

    public function test_public_landing_can_resolve_style_by_qr_token(): void
    {
        $ctx = $this->seedOwner();

        $this->withToken($ctx['token'])
            ->postJson('/api/onboarding/branch', [
                'name' => 'Tân Sơn',
                'address' => '123 Tân Sơn',
                'check_in_radius_meters' => 100,
            ])
            ->assertCreated();
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/marketing/reviews/form-meta')
            ->assertOk();
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->putJson('/api/marketing/landing', [
                'style' => ['primary' => '#2563EB'],
                'landing' => [
                    'shopName' => 'GENKY QR',
                ],
            ])
            ->assertOk();
        $this->app['auth']->forgetGuards();

        $qr = $this->withToken($ctx['token'])
            ->postJson('/api/marketing/qr-codes/ensure-branches')
            ->assertOk()
            ->json('data.0');
        $this->app['auth']->forgetGuards();

        $this->assertNotEmpty($qr['token']);
        $this->assertTrue(
            MarketingQrCode::withoutGlobalScopes()->where('token', $qr['token'])->exists()
        );

        $this->getJson('/api/public/review-reward/landing?token='.$qr['token'])
            ->assertOk()
            ->assertJsonPath('data.style.primary', '#2563EB')
            ->assertJsonPath('data.landing.shopName', 'GENKY QR');
    }
}
