<?php

namespace Tests\Feature\Marketing;

use App\Models\MarketingReviewCampaign;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MarketingDefaultCampaignTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, branch_id: int}
     */
    protected function seedOwnerWithBranch(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-mkt@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH MKT',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH MKT',
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

    public function test_form_meta_auto_creates_default_active_campaign(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $this->assertDatabaseCount('marketing_review_campaigns', 0);

        $meta = $this->withToken($ctx['token'])
            ->getJson('/api/marketing/reviews/form-meta')
            ->assertOk()
            ->json('data');

        $this->assertNotNull($meta['campaign']);
        $this->assertSame('Mặc định', $meta['campaign']['name']);
        $this->assertNotEmpty($meta['channels']);
        $this->assertNotEmpty($meta['branches']);

        $this->assertDatabaseHas('marketing_review_campaigns', [
            'name' => 'Mặc định',
            'status' => MarketingReviewCampaign::STATUS_ACTIVE,
        ]);
    }

    public function test_can_add_review_without_precreated_campaign(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $meta = $this->withToken($ctx['token'])
            ->getJson('/api/marketing/reviews/form-meta')
            ->assertOk()
            ->json('data');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->postJson('/api/marketing/reviews', [
                'branch_id' => $ctx['branch_id'],
                'channel_id' => $meta['channels'][0]['id'],
                'order_code' => '#1234-567890',
                'rating' => 5,
            ])
            ->assertCreated();
    }
}
