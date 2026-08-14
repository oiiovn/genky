<?php

namespace App\Support\Authorization;

use App\Models\OrganizationUser;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;

class RoleManagePermission
{
    public function __construct(private readonly User $user)
    {
    }

    public static function for(?User $user = null): self
    {
        $user ??= auth()->user();

        if (! $user) {
            throw new AuthorizationException('Chưa đăng nhập.');
        }

        return new self($user);
    }

    public function role(): ?string
    {
        return $this->user->roleIn(TenantContext::organization());
    }

    public function canManage(): bool
    {
        return in_array($this->role(), [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
            OrganizationUser::ROLE_HR,
        ], true);
    }

    public function assertCanManage(): void
    {
        if (! $this->canManage()) {
            throw new AuthorizationException('Bạn không có quyền quản lý vai trò & quyền.');
        }
    }
}
