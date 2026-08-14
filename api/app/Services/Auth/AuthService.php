<?php

namespace App\Services\Auth;

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\RefreshToken;
use App\Models\User;
use App\Models\ActivityLog;
use App\Services\Activity\ActivityLogService;
use App\Services\Organization\OrganizationService;
use App\Services\Settings\UserPreferencesService;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthService
{
    public function register(array $data): array
    {
        return DB::transaction(function () use ($data) {
            $email = $this->normalizeLoginId($data['email']);
            $phone = isset($data['phone']) ? $this->normalizePhone($data['phone']) : null;

            $user = User::query()->create([
                'name' => trim($data['name']),
                'email' => $email,
                'phone' => $phone,
                'password' => $data['password'],
            ]);

            $organization = Organization::query()->create([
                'name' => trim($data['organization_name']),
                'slug' => Organization::makeSlug($data['organization_name']),
                'owner_id' => $user->id,
            ]);

            OrganizationUser::query()->create([
                'organization_id' => $organization->id,
                'user_id' => $user->id,
                'role' => OrganizationUser::ROLE_OWNER,
                'is_default' => true,
            ]);

            $user->forceFill([
                'current_organization_id' => $organization->id,
            ])->save();

            app(\App\Services\Feature\FeatureEntitlementService::class)
                ->assignDefaultSubscription($organization, \App\Models\Plan::FREE);

            $user->setRelation('currentOrganization', $organization);

            $tokens = $this->issueTokens($user, $organization);
            $this->security()->recordLogin($user, true);
            $this->activity()->recordAuth($user, ActivityLog::ACTION_LOGIN, true);

            return $tokens;
        });
    }

    public function login(string $login, string $password): array
    {
        $login = $this->normalizeLoginId($login);

        $user = User::query()
            ->where(function ($query) use ($login) {
                $query->whereRaw('lower(email) = ?', [mb_strtolower($login)])
                    ->orWhere('phone', $login)
                    ->orWhere('phone', $this->normalizePhone($login));
            })
            ->first();

        if (! $user) {
            throw ValidationException::withMessages([
                'login' => ['Không tìm thấy tài khoản với email/SĐT này.'],
            ]);
        }

        $passwordOk = Hash::check($password, $user->password)
            || Hash::check(trim($password), $user->password);

        if (! $passwordOk) {
            $this->security()->recordLogin($user, false, 'Mật khẩu không đúng');
            $this->activity()->recordAuth($user, ActivityLog::ACTION_LOGIN, false, 'Mật khẩu không đúng');
            throw ValidationException::withMessages([
                'password' => ['Mật khẩu không đúng.'],
            ]);
        }

        $organization = $user->currentOrganization
            ?? $user->organizations()->orderByPivot('is_default', 'desc')->first();

        if (! $organization) {
            $this->security()->recordLogin($user, false, 'Chưa thuộc tổ chức');
            $this->activity()->recordAuth($user, ActivityLog::ACTION_LOGIN, false, 'Chưa thuộc tổ chức');
            throw ValidationException::withMessages([
                'login' => ['Tài khoản chưa thuộc tổ chức nào. Vui lòng liên hệ quản trị viên.'],
            ]);
        }

        if (! $user->current_organization_id) {
            $user->forceFill(['current_organization_id' => $organization->id])->save();
        }

        $user->setRelation('currentOrganization', $organization);

        $tokens = $this->issueTokens($user, $organization);
        $this->security()->recordLogin($user, true);
        $this->activity()->recordAuth($user, ActivityLog::ACTION_LOGIN, true);

        return $tokens;
    }

    public function refresh(string $refreshToken): array
    {
        $hash = hash('sha256', $refreshToken);

        $stored = RefreshToken::query()
            ->where('token_hash', $hash)
            ->first();

        if (! $stored || ! $stored->isValid()) {
            throw ValidationException::withMessages([
                'refresh_token' => ['Refresh token không hợp lệ hoặc đã hết hạn.'],
            ]);
        }

        $user = $stored->user;
        $organization = $stored->organization
            ?? $user->currentOrganization
            ?? $user->organizations()->first();

        if (! $organization || ! $user->belongsToOrganization($organization->id)) {
            throw ValidationException::withMessages([
                'refresh_token' => ['Không tìm thấy tổ chức hợp lệ.'],
            ]);
        }

        $stored->forceFill(['revoked_at' => now()])->save();

        if ($stored->access_token_id) {
            $user->tokens()->where('id', $stored->access_token_id)->delete();
        }

        return $this->issueTokens($user, $organization);
    }

    public function logout(User $user, ?string $refreshToken = null): void
    {
        $bearer = request()->bearerToken();

        if ($bearer && str_contains($bearer, '|')) {
            [$id] = explode('|', $bearer, 2);
            $user->tokens()->where('id', $id)->delete();
        } else {
            $token = $user->currentAccessToken();
            if ($token instanceof \Laravel\Sanctum\PersonalAccessToken) {
                $token->delete();
            }
        }

        if ($refreshToken) {
            RefreshToken::query()
                ->where('user_id', $user->id)
                ->where('token_hash', hash('sha256', $refreshToken))
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);
        }

        $this->activity()->recordAuth($user, ActivityLog::ACTION_LOGOUT, true);
    }

    public function logoutOthers(User $user, ?string $refreshToken = null): void
    {
        $current = $user->currentAccessToken();
        $currentId = $current instanceof \Laravel\Sanctum\PersonalAccessToken
            ? $current->id
            : null;

        $query = $user->tokens();
        if ($currentId) {
            $query->where('id', '!=', $currentId);
        }
        $query->delete();

        $refreshQuery = RefreshToken::query()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at');

        if ($refreshToken) {
            $refreshQuery->where('token_hash', '!=', hash('sha256', $refreshToken));
        } elseif ($currentId) {
            $refreshQuery->where(function ($inner) use ($currentId) {
                $inner->where('access_token_id', '!=', $currentId)
                    ->orWhereNull('access_token_id');
            });
        }

        $refreshQuery->update(['revoked_at' => now()]);

        $this->activity()->recordAuth(
            $user,
            ActivityLog::ACTION_UPDATE,
            true,
            null,
            'Đăng xuất thiết bị khác',
        );
    }

    public function updateProfile(User $user, array $data): User
    {
        $user->fill(collect($data)->only(['name', 'phone'])->all());
        $user->save();

        return $user->fresh();
    }

    public function changePassword(User $user, string $current, string $new): void
    {
        if (! Hash::check($current, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Mật khẩu hiện tại không đúng.'],
            ]);
        }

        $user->forceFill(['password' => $new])->save();
        $this->activity()->recordAuth(
            $user,
            ActivityLog::ACTION_UPDATE,
            true,
            null,
            'Đổi mật khẩu',
        );
    }

    public function logoutAll(User $user): void
    {
        $user->tokens()->delete();

        RefreshToken::query()
            ->where('user_id', $user->id)
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);

        $this->activity()->recordAuth($user, ActivityLog::ACTION_LOGOUT, true, null, 'Đăng xuất tất cả thiết bị');
    }

    public function me(User $user): array
    {
        TenantContext::fromUser($user);

        $organization = TenantContext::organization();
        $role = $user->roleIn($organization);
        $setup = null;

        if ($organization) {
            $branchesCount = $organization->branches()->count();
            $hasProfile = $organization->hasOrganizationProfile();
            $completed = $organization->isSetupCompleted() || ($hasProfile && $branchesCount > 0);

            $setup = [
                'has_organization_profile' => $hasProfile,
                'has_branch' => $branchesCount > 0,
                'branches_count' => $branchesCount,
                'setup_completed' => $completed,
                'next_step' => match (true) {
                    ! $hasProfile => 'organization',
                    $branchesCount === 0 => 'branch',
                    default => 'dashboard',
                },
            ];
        }

        return [
            'user' => $this->userPayload($user),
            'organization' => $organization ? $this->organizationPayload($organization) : null,
            'role' => $role,
            'setup' => $setup,
            'access' => $organization
                ? \App\Support\Authorization\EffectivePermission::for($user)->payload()
                : null,
            'entitlements' => $organization
                ? app(\App\Services\Feature\FeatureEntitlementService::class)->catalogForOrganization($organization)
                : null,
            'interface' => $organization
                ? app(\App\Services\Settings\InterfaceSettingsService::class)->fromOrganization($organization)
                : \App\Services\Settings\InterfaceSettingsService::DEFAULTS,
            'preferences' => app(UserPreferencesService::class)->show($user),
            'organizations' => $user->organizations()
                ->get()
                ->map(fn (Organization $org) => [
                    ...$this->organizationPayload($org),
                    'role' => $org->pivot->role,
                    'is_default' => (bool) $org->pivot->is_default,
                ])
                ->values()
                ->all(),
        ];
    }

    /**
     * Phát access/refresh token cho user đã thuộc organization (login, invite accept…).
     */
    public function issueSession(User $user, Organization $organization): array
    {
        return $this->issueTokens($user, $organization);
    }

    protected function issueTokens(User $user, Organization $organization): array
    {
        TenantContext::set($organization);

        $accessToken = $user->createToken(
            name: 'api',
            abilities: ['*'],
            expiresAt: now()->addMinutes((int) config('auth.access_token_ttl', 60))
        );

        $accessToken->accessToken->forceFill([
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
        ])->save();

        $plainRefresh = Str::random(64);

        RefreshToken::query()->create([
            'user_id' => $user->id,
            'organization_id' => $organization->id,
            'access_token_id' => $accessToken->accessToken->id,
            'token_hash' => hash('sha256', $plainRefresh),
            'expires_at' => now()->addDays((int) config('auth.refresh_token_ttl', 30)),
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'last_used_at' => now(),
        ]);

        return [
            'token_type' => 'Bearer',
            'access_token' => $accessToken->plainTextToken,
            'access_token_expires_at' => $accessToken->accessToken->expires_at?->toIso8601String(),
            'refresh_token' => $plainRefresh,
            'refresh_token_expires_at' => now()
                ->addDays((int) config('auth.refresh_token_ttl', 30))
                ->toIso8601String(),
            'user' => $this->userPayload($user),
            'organization' => $this->organizationPayload($organization),
            'role' => $user->roleIn($organization),
        ];
    }

    public function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'current_organization_id' => $user->current_organization_id,
            'avatar_url' => $user->avatarUrl(),
            'has_avatar' => filled($user->avatar_path),
        ];
    }

    protected function security(): AccountSecurityService
    {
        return app(AccountSecurityService::class);
    }

    protected function activity(): ActivityLogService
    {
        return app(ActivityLogService::class);
    }

    protected function organizationPayload(Organization $organization): array
    {
        return app(OrganizationService::class)->payload($organization);
    }

    protected function normalizeLoginId(string $value): string
    {
        $value = trim($value);

        if (str_contains($value, '@')) {
            return mb_strtolower($value);
        }

        return $this->normalizePhone($value);
    }

    protected function normalizePhone(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $digits = preg_replace('/\s+/', '', trim($value));

        return $digits === '' ? null : $digits;
    }
}
