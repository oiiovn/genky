<?php

namespace App\Support\Authorization;

use App\Models\Employee;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;

class EmployeePermission
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
        ], true);
    }

    public function canCreate(): bool
    {
        return in_array($this->role(), [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
            OrganizationUser::ROLE_HR,
            OrganizationUser::ROLE_MANAGER,
        ], true);
    }

    public function canUpdate(Employee $employee): bool
    {
        if ($this->isOrgWide()) {
            return true;
        }

        if ($this->isManager()) {
            return $this->sharesBranchWith($employee);
        }

        return $this->isSelf($employee);
    }

    public function canDelete(Employee $employee): bool
    {
        return in_array($this->role(), [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
            OrganizationUser::ROLE_HR,
        ], true);
    }

    public function canAssignBranch(Employee $employee): bool
    {
        if ($this->isOrgWide()) {
            return true;
        }

        return $this->isManager() && $this->sharesBranchWith($employee);
    }

    public function canInvite(Employee $employee): bool
    {
        return $this->canUpdate($employee) && ! $this->isEmployeeOnly();
    }

    public function canView(Employee $employee): bool
    {
        if ($this->isOrgWide()) {
            return true;
        }

        if ($this->isManager()) {
            return $this->sharesBranchWith($employee);
        }

        return $this->isSelf($employee);
    }

    public function assertCanViewAny(): void
    {
        if ($this->isEmployeeOnly()) {
            return;
        }

        if (! $this->canViewAny()) {
            throw new AuthorizationException('Bạn không có quyền xem danh sách nhân viên.');
        }
    }

    public function assertCanCreate(): void
    {
        if (! $this->canCreate()) {
            throw new AuthorizationException('Bạn không có quyền tạo nhân viên.');
        }
    }

    public function assertCanView(Employee $employee): void
    {
        if (! $this->canView($employee)) {
            throw new AuthorizationException('Bạn không có quyền xem nhân viên này.');
        }
    }

    public function assertCanUpdate(Employee $employee): void
    {
        if (! $this->canUpdate($employee)) {
            throw new AuthorizationException('Bạn không có quyền sửa nhân viên này.');
        }
    }

    public function assertCanDelete(Employee $employee): void
    {
        if (! $this->canDelete($employee)) {
            throw new AuthorizationException('Bạn không có quyền xoá nhân viên.');
        }
    }

    public function assertCanAssignBranch(Employee $employee): void
    {
        if (! $this->canAssignBranch($employee)) {
            throw new AuthorizationException('Bạn không có quyền gán chi nhánh.');
        }
    }

    public function assertCanInvite(Employee $employee): void
    {
        if (! $this->canInvite($employee)) {
            throw new AuthorizationException('Bạn không có quyền mời nhân viên dùng app.');
        }
    }

    public function isSelf(Employee $employee): bool
    {
        return $employee->user_id !== null
            && (int) $employee->user_id === (int) $this->user->id;
    }

    /**
     * @return Collection<int, int>
     */
    public function managedBranchIds(): Collection
    {
        $employee = Employee::query()
            ->where('user_id', $this->user->id)
            ->first();

        if (! $employee) {
            return collect();
        }

        return $employee->branches()->pluck('branches.id');
    }

    public function sharesBranchWith(Employee $employee): bool
    {
        $managed = $this->managedBranchIds();

        if ($managed->isEmpty()) {
            return false;
        }

        return $employee->branches()
            ->whereIn('branches.id', $managed)
            ->exists();
    }
}
