<?php

namespace Tests\Feature\Marketing;

use App\Models\Employee;
use App\Models\MarketingRewardCode;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MarketingRewardRedeemTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, org_id: int, branch_id: int, channel_id: int}
     */
    protected function seedShop(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-redeem@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH REDEEM',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH REDEEM',
            'phone' => '0902222222',
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

    /**
     * @return array{token: string, branch_id: int, code: string, id: int}
     */
    protected function issuedCode(): array
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

        $check = $this->withToken($ctx['token'])
            ->postJson('/api/marketing/reward-codes/check', ['code' => $code])
            ->assertOk()
            ->json('data');
        $this->app['auth']->forgetGuards();

        return [
            'token' => $ctx['token'],
            'branch_id' => $ctx['branch_id'],
            'code' => $code,
            'id' => (int) $check['id'],
        ];
    }

    public function test_check_unknown_code_returns_422(): void
    {
        $ctx = $this->seedShop();

        $this->withToken($ctx['token'])
            ->postJson('/api/marketing/reward-codes/check', [
                'code' => 'KHONG-CO-MA',
            ])
            ->assertStatus(422);
    }

    public function test_staff_can_check_and_redeem_gift_code(): void
    {
        $ctx = $this->issuedCode();

        $check = $this->withToken($ctx['token'])
            ->postJson('/api/marketing/reward-codes/check', [
                'code' => $ctx['code'],
            ])
            ->assertOk()
            ->json('data');
        $this->app['auth']->forgetGuards();

        $this->assertTrue($check['valid']);
        $this->assertSame($ctx['code'], $check['code']);
        $this->assertSame(MarketingRewardCode::STATUS_ISSUED, $check['status']);
        $this->assertNotEmpty($check['reward']['name']);
        $this->assertSame('#08086-443874188', $check['order']['order_code']);

        $byOrder = $this->withToken($ctx['token'])
            ->postJson('/api/marketing/reward-codes/check', [
                'code' => '08086-443874188',
            ])
            ->assertOk()
            ->json('data');
        $this->app['auth']->forgetGuards();
        $this->assertSame($ctx['code'], $byOrder['code']);

        $digits = preg_replace('/[^A-Z0-9]/i', '', $ctx['code']) ?? $ctx['code'];
        $suffix = substr($digits, -4);
        $bySuffix = $this->withToken($ctx['token'])
            ->postJson('/api/marketing/reward-codes/check', [
                'code' => $suffix,
            ])
            ->assertOk()
            ->json('data');
        $this->app['auth']->forgetGuards();
        $this->assertSame($ctx['code'], $bySuffix['code']);

        $this->withToken($ctx['token'])
            ->postJson("/api/marketing/reward-codes/{$ctx['id']}/redeem", [
                'branch_id' => $ctx['branch_id'],
                'note' => 'Đã giao tại quầy',
            ])
            ->assertOk()
            ->assertJsonPath('message', 'Đã đổi quà thành công.');
        $this->app['auth']->forgetGuards();

        $this->assertDatabaseHas('marketing_reward_codes', [
            'id' => $ctx['id'],
            'status' => MarketingRewardCode::STATUS_REDEEMED,
        ]);

        $after = $this->withToken($ctx['token'])
            ->postJson('/api/marketing/reward-codes/check', [
                'code' => $ctx['code'],
            ])
            ->assertOk()
            ->json('data');
        $this->app['auth']->forgetGuards();
        $this->assertFalse($after['valid']);
        $this->assertSame('Mã đã được đổi.', $after['reason']);

        $history = $this->withToken($ctx['token'])
            ->getJson('/api/marketing/reward-redemptions')
            ->assertOk()
            ->json('data');

        $this->assertSame(1, $history['redeemStats']['total']);
        $this->assertSame($ctx['code'], $history['redeemRows'][0]['giftCode']);
        $this->assertSame('#08086-443874188', $history['redeemRows'][0]['orderCode']);
        $this->assertSame('Đã giao tại quầy', $history['redeemRows'][0]['note']);
    }

    public function test_cannot_redeem_twice(): void
    {
        $ctx = $this->issuedCode();

        $this->withToken($ctx['token'])
            ->postJson("/api/marketing/reward-codes/{$ctx['id']}/redeem", [
                'branch_id' => $ctx['branch_id'],
            ])
            ->assertOk();
        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->postJson("/api/marketing/reward-codes/{$ctx['id']}/redeem", [
                'branch_id' => $ctx['branch_id'],
            ])
            ->assertStatus(422);
    }

    public function test_staff_employee_can_check_and_redeem(): void
    {
        $ctx = $this->issuedCode();
        $orgId = (int) Organization::query()->orderByDesc('id')->value('id');

        $employee = $this->withToken($ctx['token'])
            ->postJson('/api/employees', [
                'full_name' => 'Nhân Viên Quầy',
                'branch_ids' => [$ctx['branch_id']],
            ])
            ->assertCreated()
            ->json('data');
        $this->app['auth']->forgetGuards();

        $staffUser = User::factory()->create([
            'email' => 'staff-redeem@fresh.test',
            'password' => 'Password1!',
            'current_organization_id' => $orgId,
        ]);

        OrganizationUser::query()->create([
            'organization_id' => $orgId,
            'user_id' => $staffUser->id,
            'role' => OrganizationUser::ROLE_EMPLOYEE,
            'is_default' => true,
        ]);

        Employee::query()->withoutGlobalScopes()->whereKey($employee['id'])->update([
            'user_id' => $staffUser->id,
        ]);

        $login = $this->postJson('/api/auth/login', [
            'login' => 'staff-redeem@fresh.test',
            'password' => 'Password1!',
        ])->assertOk()->json();
        $this->app['auth']->forgetGuards();

        $staffToken = $login['access_token'];

        $check = $this->withToken($staffToken)
            ->postJson('/api/marketing/reward-codes/check', [
                'code' => $ctx['code'],
            ])
            ->assertOk()
            ->json('data');
        $this->app['auth']->forgetGuards();

        $this->assertTrue($check['valid']);
        $this->assertSame($ctx['code'], $check['code']);

        $this->withToken($staffToken)
            ->postJson("/api/marketing/reward-codes/{$ctx['id']}/redeem", [
                'branch_id' => $ctx['branch_id'],
            ])
            ->assertOk();
    }

    public function test_can_update_and_delete_redemption_history(): void
    {
        $ctx = $this->issuedCode();

        $this->withToken($ctx['token'])
            ->postJson("/api/marketing/reward-codes/{$ctx['id']}/redeem", [
                'branch_id' => $ctx['branch_id'],
                'note' => 'Lúc đầu',
            ])
            ->assertOk();
        $this->app['auth']->forgetGuards();

        $history = $this->withToken($ctx['token'])
            ->getJson('/api/marketing/reward-redemptions')
            ->assertOk()
            ->json('data');
        $this->app['auth']->forgetGuards();
        $redemptionId = $history['redeemRows'][0]['id'];

        $this->withToken($ctx['token'])
            ->putJson("/api/marketing/reward-redemptions/{$redemptionId}", [
                'note' => 'Đã giao lại',
                'branch_id' => $ctx['branch_id'],
            ])
            ->assertOk();
        $this->app['auth']->forgetGuards();

        $updated = $this->withToken($ctx['token'])
            ->getJson('/api/marketing/reward-redemptions')
            ->assertOk()
            ->json('data.redeemRows.0');
        $this->app['auth']->forgetGuards();
        $this->assertSame('Đã giao lại', $updated['note']);

        $empty = $this->withToken($ctx['token'])
            ->getJson('/api/marketing/reward-redemptions?from=2020-01-01&to=2020-01-02')
            ->assertOk()
            ->json('data');
        $this->app['auth']->forgetGuards();
        $this->assertSame(0, $empty['redeemStats']['total']);

        $this->withToken($ctx['token'])
            ->deleteJson("/api/marketing/reward-redemptions/{$redemptionId}")
            ->assertOk();
        $this->app['auth']->forgetGuards();

        $this->assertDatabaseHas('marketing_reward_codes', [
            'id' => $ctx['id'],
            'status' => MarketingRewardCode::STATUS_ISSUED,
        ]);
    }
}
