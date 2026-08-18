<?php

namespace Tests\Feature\Marketing;

use App\Models\MarketingCampaignBranch;
use App\Models\MarketingQrCode;
use App\Models\MarketingReviewCampaign;
use App\Models\Organization;
use App\Support\Tenancy\TenantContext;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MarketingBranchQrTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, org_id: int, branch_id: int}
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

        $this->withToken($token)
            ->getJson('/api/marketing/reviews/form-meta')
            ->assertOk();
        $this->app['auth']->forgetGuards();

        return [
            'token' => $token,
            'org_id' => (int) Organization::query()->orderByDesc('id')->value('id'),
            'branch_id' => (int) $branch['id'],
        ];
    }

    public function test_ensure_keeps_same_token_and_uses_short_code(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $first = $this->withToken($ctx['token'])
            ->postJson('/api/marketing/qr-codes/ensure-branches')
            ->assertOk()
            ->json('data');
        $this->app['auth']->forgetGuards();

        $this->assertCount(1, $first);
        $this->assertSame($ctx['branch_id'], (int) $first[0]['branch_id']);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{8}$/', $first[0]['token']);

        $again = $this->withToken($ctx['token'])
            ->postJson('/api/marketing/qr-codes/ensure-branches')
            ->assertOk()
            ->json('data');
        $this->app['auth']->forgetGuards();

        $this->assertSame($first[0]['token'], $again[0]['token']);
        $this->assertSame($first[0]['id'], $again[0]['id']);
    }

    public function test_token_stays_when_campaign_changes(): void
    {
        $ctx = $this->seedOwnerWithBranch();

        $first = $this->withToken($ctx['token'])
            ->postJson('/api/marketing/qr-codes/ensure-branches')
            ->assertOk()
            ->json('data.0');
        $this->app['auth']->forgetGuards();

        $oldToken = $first['token'];
        $oldCampaignId = (int) $first['campaign_id'];

        TenantContext::set(Organization::query()->findOrFail($ctx['org_id']));
        try {
            $old = MarketingReviewCampaign::query()->findOrFail($oldCampaignId);
            $old->status = MarketingReviewCampaign::STATUS_PAUSED;
            $old->save();

            $next = MarketingReviewCampaign::query()->create([
                'organization_id' => $ctx['org_id'],
                'name' => 'Chiến dịch mới',
                'status' => MarketingReviewCampaign::STATUS_ACTIVE,
                'start_at' => now()->subDay(),
                'end_at' => now()->addYear(),
                'min_rating' => 1,
            ]);
            MarketingCampaignBranch::query()->create([
                'campaign_id' => $next->id,
                'branch_id' => $ctx['branch_id'],
            ]);
        } finally {
            TenantContext::clear();
        }

        $second = $this->withToken($ctx['token'])
            ->postJson('/api/marketing/qr-codes/ensure-branches')
            ->assertOk()
            ->json('data.0');
        $this->app['auth']->forgetGuards();

        $this->assertSame($oldToken, $second['token']);
        $this->assertNotSame($oldCampaignId, (int) $second['campaign_id']);
        $this->assertSame(1, MarketingQrCode::withoutGlobalScopes()->count());
    }
}
