<?php

namespace Tests\Feature\Marketing;

use App\Support\AppTimezone;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MarketingFlashSaleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, branch_id: int, token_b: string}
     */
    protected function seedTwoOrgs(): array
    {
        $a = $this->seedOwner('owner-fs@fresh.test', 'FRESH FS', 'Tân Sơn');
        $b = $this->seedOwner('owner-fs-b@fresh.test', 'FRESH B', 'Quận 7');

        return [
            'token' => $a['token'],
            'branch_id' => $a['branch_id'],
            'token_b' => $b['token'],
        ];
    }

    /**
     * @return array{token: string, branch_id: int}
     */
    protected function seedOwner(string $email, string $org, string $branchName): array
    {
        $this->flushHeaders();
        $this->app['auth']->forgetGuards();
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => $email,
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => $org,
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => $org,
            'phone' => '0901111111',
            'address' => 'Gò Vấp',
        ]);
        $this->app['auth']->forgetGuards();

        $branch = $this->withToken($token)->postJson('/api/onboarding/branch', [
            'name' => $branchName,
            'address' => '123 Lê Văn Quới',
            'check_in_radius_meters' => 100,
        ])->json('branch');
        $this->app['auth']->forgetGuards();

        return [
            'token' => $token,
            'branch_id' => $branch['id'],
        ];
    }

    public function test_create_list_update_end_and_delete(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-18 10:00:00', AppTimezone::ZONE));
        $ctx = $this->seedTwoOrgs();

        $created = $this->withToken($ctx['token'])->postJson('/api/marketing/flash-sales', [
            'title' => 'Flash Sale 8.8',
            'branch_id' => $ctx['branch_id'],
            'banner' => '88',
            'starts_at' => '2026-08-18 09:00:00',
            'ends_at' => '2026-08-18 18:00:00',
            'slots' => ['12:00-14:00', '00:00 - 02:00'],
            'quota' => 400,
            'sold_count' => 100,
            'revenue' => 2_000_000,
            'products' => [
                ['name' => 'Cơm gà', 'emoji' => '🍗', 'price' => 79000, 'original_price' => 99000, 'slot_start' => '12:00', 'slot_end' => '14:00'],
                ['name' => 'Trà sữa', 'emoji' => '🧋', 'price' => 45000, 'original_price' => 65000, 'slot_start' => '00:00', 'slot_end' => '02:00'],
            ],
        ])->assertCreated()->json('data');

        $this->assertSame('upcoming', $created['status']);
        $this->assertSame('Tân Sơn', $created['branch']);
        $this->assertSame('18/08/2026', $created['date_label']);
        $this->assertStringContainsString('12:00 - 14:00', $created['slots_label']);
        $this->assertSame(11, $created['progress']);
        $this->assertNull($created['active_product_name']);
        $this->assertSame('upcoming', $created['products'][0]['status']);
        $this->assertSame('12:00 - 14:00', $created['products'][0]['slot_label']);

        $list = $this->withToken($ctx['token'])
            ->getJson('/api/marketing/flash-sales?status=upcoming')
            ->assertOk()
            ->json();

        $this->assertSame(0, $list['stats']['running']);
        $this->assertSame(1, $list['stats']['upcoming']);
        $this->assertSame(1, $list['stats']['total']);
        $this->assertCount(1, $list['data']);

        $id = $created['id'];
        $this->withToken($ctx['token'])->patchJson('/api/marketing/flash-sales/'.$id, [
            'title' => 'Flash Sale 8.8 Super',
            'sold_count' => 300,
            'products' => [
                ['name' => 'Cơm gà', 'emoji' => '🍗', 'price' => 69000, 'original_price' => 99000],
            ],
        ])->assertOk()->assertJsonPath('data.title', 'Flash Sale 8.8 Super')
            ->assertJsonPath('data.sold', 300)
            ->assertJsonPath('data.status', 'running')
            ->assertJsonPath('data.progress', 11);

        $this->assertDatabaseCount('marketing_flash_sale_products', 1);

        $this->withToken($ctx['token'])
            ->postJson('/api/marketing/flash-sales/'.$id.'/end')
            ->assertOk()
            ->assertJsonPath('data.status', 'ended');

        $history = $this->withToken($ctx['token'])
            ->getJson('/api/marketing/flash-sales/history')
            ->assertOk()
            ->json('data');
        $this->assertCount(1, $history);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token_b'])
            ->getJson('/api/marketing/flash-sales')
            ->assertOk()
            ->assertJsonPath('stats.total', 0);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->deleteJson('/api/marketing/flash-sales/'.$id)
            ->assertOk();

        $this->assertDatabaseCount('marketing_flash_sales', 0);
        $this->assertDatabaseCount('marketing_flash_sale_products', 0);

        Carbon::setTestNow();
    }

    public function test_upcoming_and_search_filter(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-18 10:00:00', AppTimezone::ZONE));
        $ctx = $this->seedOwner('owner-fs2@fresh.test', 'FRESH FS2', 'Tân Sơn');

        $this->withToken($ctx['token'])->postJson('/api/marketing/flash-sales', [
            'title' => 'Flash Sale 9.9',
            'branch_id' => $ctx['branch_id'],
            'banner' => '99',
            'starts_at' => '2026-09-09 09:00:00',
            'ends_at' => '2026-09-09 22:00:00',
            'slots' => ['09:00-11:00'],
        ])->assertCreated()->assertJsonPath('data.status', 'upcoming');

        $this->withToken($ctx['token'])->postJson('/api/marketing/flash-sales', [
            'title' => 'Sale giữa tháng',
            'starts_at' => '2026-07-01 00:00:00',
            'ends_at' => '2026-07-02 00:00:00',
        ])->assertCreated()->assertJsonPath('data.status', 'ended');

        $aug = $this->withToken($ctx['token'])
            ->getJson('/api/marketing/flash-sales?month=2026-08')
            ->assertOk()
            ->json();
        $this->assertSame(0, $aug['stats']['total']);

        $sep = $this->withToken($ctx['token'])
            ->getJson('/api/marketing/flash-sales?month=2026-09&search=9.9')
            ->assertOk()
            ->json();
        $this->assertCount(1, $sep['data']);
        $this->assertSame('upcoming', $sep['data'][0]['status']);

        Carbon::setTestNow();
    }

    public function test_product_slot_is_running_and_image_upload(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-18 13:00:00', AppTimezone::ZONE));
        $ctx = $this->seedOwner('owner-fs-slot@fresh.test', 'FRESH SLOT', 'Tân Sơn');
        Storage::fake('public');

        $created = $this->withToken($ctx['token'])->postJson('/api/marketing/flash-sales', [
            'title' => 'Sale slot',
            'branch_id' => $ctx['branch_id'],
            'starts_at' => '2026-08-18 09:00:00',
            'ends_at' => '2026-08-18 18:00:00',
            'products' => [
                ['name' => 'Cơm gà', 'slot_start' => '12:00', 'slot_end' => '14:00', 'price' => 79000],
                ['name' => 'Phở', 'slot_start' => '15:00', 'slot_end' => '17:00', 'price' => 99000],
            ],
        ])->assertCreated()->json('data');

        $this->assertSame('running', $created['products'][0]['status']);
        $this->assertSame('Cơm gà', $created['active_product_name']);
        $this->assertSame('upcoming', $created['products'][1]['status']);
        $this->assertSame('running', $created['status']);
        $this->assertSame(44, $created['progress']);

        $id = $created['id'];
        $productId = $created['products'][0]['id'];
        $upload = $this->withToken($ctx['token'])->post(
            '/api/marketing/flash-sales/'.$id.'/products/'.$productId.'/image',
            ['image' => UploadedFile::fake()->image('ga.jpg', 60, 60)],
            ['Accept' => 'application/json'],
        )->assertOk()->json();
        $this->assertNotEmpty($upload['product']['image_url'] ?? null);

        Carbon::setTestNow();
    }

    public function test_before_slot_is_upcoming_and_progress_follows_clock(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-08-19 12:22:00', AppTimezone::ZONE));
        $ctx = $this->seedOwner('owner-fs-live@fresh.test', 'FRESH LIVE', 'Lê Văn Quới');

        $created = $this->withToken($ctx['token'])->postJson('/api/marketing/flash-sales', [
            'title' => 'Gói Quảng Cáo Flash Sale Hót Q3 2026',
            'branch_id' => $ctx['branch_id'],
            'starts_at' => '2026-08-18 00:00:00',
            'ends_at' => '2026-08-24 23:59:59',
            'products' => [
                ['name' => 'Cuốn Lòng Đào', 'slot_start' => '13:00', 'slot_end' => '16:00', 'price' => 9000, 'original_price' => 50953],
                ['name' => 'SET ĐẦY ĐỦ', 'slot_start' => '20:00', 'slot_end' => '22:00', 'price' => 60500, 'original_price' => 121000],
            ],
        ])->assertCreated()->json('data');

        $this->assertSame('upcoming', $created['status']);
        $this->assertNull($created['active_product_name']);
        $this->assertSame(22, $created['progress']);
        $this->assertSame('upcoming', $created['products'][0]['status']);

        $id = $created['id'];

        Carbon::setTestNow(Carbon::parse('2026-08-19 14:30:00', AppTimezone::ZONE));
        $mid = $this->withToken($ctx['token'])
            ->getJson('/api/marketing/flash-sales/'.$id)
            ->assertOk()
            ->json('data');
        $this->assertSame('running', $mid['status']);
        $this->assertSame('Cuốn Lòng Đào', $mid['active_product_name']);
        $this->assertSame(23, $mid['progress']);

        Carbon::setTestNow(Carbon::parse('2026-08-19 17:00:00', AppTimezone::ZONE));
        $gap = $this->withToken($ctx['token'])
            ->getJson('/api/marketing/flash-sales/'.$id)
            ->assertOk()
            ->json('data');
        $this->assertSame('upcoming', $gap['status']);
        $this->assertNull($gap['active_product_name']);
        $this->assertSame(24, $gap['progress']);

        Carbon::setTestNow(Carbon::parse('2026-08-19 21:00:00', AppTimezone::ZONE));
        $night = $this->withToken($ctx['token'])
            ->getJson('/api/marketing/flash-sales/'.$id)
            ->assertOk()
            ->json('data');
        $this->assertSame('running', $night['status']);
        $this->assertSame('SET ĐẦY ĐỦ', $night['active_product_name']);
        $this->assertSame(27, $night['progress']);

        Carbon::setTestNow();
    }

    public function test_rejects_invalid_range(): void
    {
        $ctx = $this->seedOwner('owner-fs3@fresh.test', 'FRESH FS3', 'Tân Sơn');

        $this->withToken($ctx['token'])->postJson('/api/marketing/flash-sales', [
            'title' => 'Sai giờ',
            'starts_at' => '2026-08-18 18:00:00',
            'ends_at' => '2026-08-18 09:00:00',
        ])->assertStatus(422);
    }
}
