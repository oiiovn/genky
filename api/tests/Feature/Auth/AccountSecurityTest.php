<?php

namespace Tests\Feature\Auth;

use App\Models\LoginHistory;
use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class AccountSecurityTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, refresh: string, user_id: int}
     */
    protected function registerOwner(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-sec@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH Sec',
        ], [
            'User-Agent' => 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0',
        ])->json();

        $this->app['auth']->forgetGuards();

        return [
            'token' => $register['access_token'],
            'refresh' => $register['refresh_token'],
            'user_id' => $register['user']['id'],
        ];
    }

    public function test_guest_cannot_read_sessions(): void
    {
        $this->getJson('/api/me/sessions')->assertUnauthorized();
        $this->getJson('/api/me/login-history')->assertUnauthorized();
    }

    public function test_login_success_and_failure_are_recorded(): void
    {
        $this->registerOwner();

        $this->postJson('/api/auth/login', [
            'login' => 'owner-sec@fresh.test',
            'password' => 'WrongPass1!',
        ])->assertUnprocessable();

        $this->postJson('/api/auth/login', [
            'login' => 'owner-sec@fresh.test',
            'password' => 'Password1!',
        ], [
            'User-Agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
        ])->assertOk();

        $this->assertSame(3, LoginHistory::query()->count());
        $this->assertSame(1, LoginHistory::query()->where('succeeded', false)->count());
        $this->assertSame(2, LoginHistory::query()->where('succeeded', true)->count());
    }

    public function test_sessions_list_marks_current_device(): void
    {
        $ctx = $this->registerOwner();

        $second = $this->postJson('/api/auth/login', [
            'login' => 'owner-sec@fresh.test',
            'password' => 'Password1!',
        ], [
            'User-Agent' => 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
        ])->json();

        $this->app['auth']->forgetGuards();

        $this->withToken($second['access_token'])
            ->getJson('/api/me/sessions')
            ->assertOk()
            ->assertJsonCount(2, 'data')
            ->assertJsonPath('data.0.current', true)
            ->assertJsonPath('data.0.kind', 'phone')
            ->assertJsonPath('data.1.current', false);
    }

    public function test_logout_others_keeps_current_session(): void
    {
        $ctx = $this->registerOwner();

        $second = $this->postJson('/api/auth/login', [
            'login' => 'owner-sec@fresh.test',
            'password' => 'Password1!',
        ])->json();

        $this->app['auth']->forgetGuards();

        $this->withToken($second['access_token'])
            ->postJson('/api/auth/logout-others', [
                'refresh_token' => $second['refresh_token'],
            ])
            ->assertOk();

        $this->app['auth']->forgetGuards();

        $this->withToken($second['access_token'])
            ->getJson('/api/me/sessions')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.current', true);

        $this->assertSame(1, RefreshToken::query()->whereNull('revoked_at')->count());
    }

    public function test_login_history_endpoint(): void
    {
        $ctx = $this->registerOwner();

        $this->withToken($ctx['token'])
            ->getJson('/api/me/login-history')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.ok', true)
            ->assertJsonStructure(['data' => [['id', 'time', 'device', 'location', 'ok']]]);
    }

    public function test_user_can_upload_and_fetch_avatar(): void
    {
        Storage::fake('public');
        $ctx = $this->registerOwner();

        $file = UploadedFile::fake()->image('avatar.jpg', 120, 120);

        $this->withToken($ctx['token'])
            ->post('/api/me/avatar', ['avatar' => $file], [
                'Accept' => 'application/json',
            ])
            ->assertOk()
            ->assertJsonPath('user.has_avatar', true);

        $user = User::query()->find($ctx['user_id']);
        $this->assertNotNull($user->avatar_path);
        Storage::disk('public')->assertExists($user->avatar_path);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->get('/api/me/avatar')
            ->assertOk();
    }
}
