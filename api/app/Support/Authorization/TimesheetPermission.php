<?php

namespace App\Support\Authorization;

use App\Models\Employee;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;

class TimesheetPermission
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

    public function managedBranchIds(): Collection
    {
        return EmployeePermission::for($this->user)->managedBranchIds();
    }

    public function ownEmployee(): ?Employee
    {
        return Employee::query()->where('user_id', $this->user->id)->first();
    }

    public function assertCanViewAny(): void
    {
        if (! $this->canViewAny()) {
            throw new AuthorizationException('Bạn không có quyền xem bảng công.');
        }
    }

    public function assertCanManage(): void
    {
        if (! $this->canManage()) {
            throw new AuthorizationException('Bạn không có quyền duyệt bảng công.');
        }
    }

    public function assertCanAccessBranch(int $branchId): void
    {
        if ($this->isOrgWide()) {
            return;
        }

        if ($this->isManager() && $this->managedBranchIds()->contains($branchId)) {
            return;
        }

        throw new AuthorizationException('Bạn không có quyền truy cập chi nhánh này.');
    }
}
