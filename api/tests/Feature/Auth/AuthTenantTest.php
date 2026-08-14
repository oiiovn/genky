<?php

namespace Tests\Feature\Auth;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTenantTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_creates_user_organization_and_owner(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'vu@genky.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH - Bánh tráng trộn',
        ]);

        $response->assertCreated()
            ->assertJsonPath('user.name', 'Vũ')
            ->assertJsonPath('organization.name', 'FRESH - Bánh tráng trộn')
            ->assertJsonPath('role', 'owner')
            ->assertJsonStructure([
                'access_token',
                'refresh_token',
                'token_type',
                'user' => ['id', 'email'],
                'organization' => ['id', 'slug'],
            ]);

        $this->assertDatabaseHas('users', ['email' => 'vu@genky.test']);
        $this->assertDatabaseHas('organizations', ['name' => 'FRESH - Bánh tráng trộn']);
        $this->assertDatabaseHas('organization_user', ['role' => 'owner']);
    }

    public function test_tenants_are_isolated(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'vu@genky.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH - Bánh tráng trộn',
        ])->assertCreated();

        $this->postJson('/api/auth/register', [
            'name' => 'Nguyễn A',
            'email' => 'a@abc.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'ABC Coffee',
        ])->assertCreated();

        $this->assertSame(2, Organization::query()->count());
        $this->assertSame(2, User::query()->count());

        $fresh = Organization::query()->where('name', 'FRESH - Bánh tráng trộn')->first();
        $abc = Organization::query()->where('name', 'ABC Coffee')->first();

        $this->assertNotSame($fresh->id, $abc->id);
        $this->assertSame('Vũ', $fresh->owner->name);
        $this->assertSame('Nguyễn A', $abc->owner->name);
    }

    public function test_login_me_refresh_logout_flow(): void
    {
        $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'vu@genky.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH - Bánh tráng trộn',
        ])->assertCreated();

        $login = $this->postJson('/api/auth/login', [
            'login' => 'vu@genky.test',
            'password' => 'Password1!',
        ])->assertOk();

        $access = $login->json('access_token');
        $refresh = $login->json('refresh_token');

        $this->withToken($access)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('organization.name', 'FRESH - Bánh tráng trộn')
            ->assertJsonPath('role', 'owner');

        $refreshed = $this->postJson('/api/auth/refresh', [
            'refresh_token' => $refresh,
        ])->assertOk();

        $newAccess = $refreshed->json('access_token');
        $newRefresh = $refreshed->json('refresh_token');

        $this->withToken($newAccess)
            ->postJson('/api/auth/logout', ['refresh_token' => $newRefresh])
            ->assertOk();

        $this->assertNull(\Laravel\Sanctum\PersonalAccessToken::findToken($newAccess));

        $this->app['auth']->forgetGuards();
        $this->flushHeaders();

        $this->getJson('/api/me', [
            'Authorization' => 'Bearer '.$newAccess,
        ])->assertUnauthorized();

        $this->postJson('/api/auth/login', [
            'email' => 'vu@genky.test',
            'password' => 'Password1!',
        ])->assertOk()
            ->assertJsonPath('user.email', 'vu@genky.test');
    }
}