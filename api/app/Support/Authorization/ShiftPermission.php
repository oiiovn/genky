<?php

namespace App\Support\Authorization;

use App\Models\OrganizationUser;
use App\Models\Shift;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;

class ShiftPermission
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

    public function isOrgWide(): bool
    {
        return in_array($this->role(), [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
            OrganizationUser::ROLE_HR,
        ], true);
    }

    public function isManager(): bool
    {
        return $this->role() === OrganizationUser::ROLE_MANAGER;
    }

    public function isEmployeeOnly(): bool
    {
        return $this->role() === OrganizationUser::ROLE_EMPLOYEE;
    }

    public function canViewAny(): bool
    {
        return in_array($this->role(), [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
            OrganizationUser::ROLE_HR,
            OrganizationUser::ROLE_MANAGER,
            OrganizationUser::ROLE_EMPLOYEE,
        ], true);
    }

    public function canManage(): bool
    {
        return in_array($this->role(), [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
            OrganizationUser::ROLE_HR,
            OrganizationUser::ROLE_MANAGER,
        ], true);
    }

    public function canDelete(): bool
    {
        return in_array($this->role(), [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
            OrganizationUser::ROLE_HR,
        ], true);
    }

    /**
     * @return Collection<int, int>
     */
    public function managedBranchIds(): Collection
    {
        return EmployeePermission::for($this->user)->managedBranchIds();
    }

    public function canAccessBranch(?int $branchId): bool
    {
        if ($this->isOrgWide()) {
            return true;
        }

        if (! $this->isManager()) {
            return false;
        }

        if ($branchId === null) {
            return false;
        }

        return $this->managedBranchIds()->contains($branchId);
    }

    public function canManageShift(Shift $shift): bool
    {
        if (! $this->canManage()) {
            return false;
        }

        if ($this->isOrgWide()) {
            return true;
        }

        if ($shift->branch_id === null) {
            return false;
        }

        return $this->managedBranchIds()->contains((int) $shift->branch_id);
    }

    public function assertCanViewAny(): void
    {
        if (! $this->canViewAny()) {
            throw new AuthorizationException('Bạn không có quyền xem ca làm.');
        }
    }

    public function assertCanManage(): void
    {
        if (! $this->canManage()) {
            throw new AuthorizationException('Bạn không có quyền quản lý ca làm.');
        }
    }

    public function assertCanDelete(): void
    {
        if (! $this->canDelete()) {
            throw new AuthorizationException('Bạn không có quyền xoá ca làm.');
        }
    }

    public function assertCanManageShift(Shift $shift): void
    {
        if (! $this->canManageShift($shift)) {
            throw new AuthorizationException('Bạn không có quyền thao tác ca làm này.');
        }
    }

    public function assertCanAccessBranch(?int $branchId): void
    {
        if (! $this->canAccessBranch($branchId)) {
            throw new AuthorizationException('Bạn không có quyền thao tác trên chi nhánh này.');
        }
    }
}
