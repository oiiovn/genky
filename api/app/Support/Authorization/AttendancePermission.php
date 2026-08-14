<?php

namespace App\Support\Authorization;

use App\Models\AttendanceLog;
use App\Models\Employee;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;

class AttendancePermission
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

    public function assertOwnerCanDeleteSynthetic(): void
    {
        if ($this->role() !== OrganizationUser::ROLE_OWNER) {
            throw new AuthorizationException(
                'Chỉ chủ quán được xoá dòng chấm công tự sinh.'
            );
        }
    }

    /**
     * @return Collection<int, int>
     */
    public function managedBranchIds(): Collection
    {
        return EmployeePermission::for($this->user)->managedBranchIds();
    }

    public function ownEmployee(): ?Employee
    {
        return Employee::query()->where('user_id', $this->user->id)->first();
    }

    public function canAccessBranch(?int $branchId): bool
    {
        if ($this->isOrgWide()) {
            return true;
        }

        if ($this->isManager()) {
            return $branchId !== null && $this->managedBranchIds()->contains($branchId);
        }

        if ($this->isEmployeeOnly()) {
            $employee = $this->ownEmployee();
            if (! $employee || $branchId === null) {
                return false;
            }

            return $employee->branches()->where('branches.id', $branchId)->exists();
        }

        return false;
    }

    public function canViewLog(AttendanceLog $log): bool
    {
        if ($this->isOrgWide()) {
            return true;
        }

        if ($this->isManager()) {
            return $this->managedBranchIds()->contains((int) $log->branch_id);
        }

        $own = $this->ownEmployee();

        return $own && (int) $own->id === (int) $log->employee_id;
    }

    public function canCheckFor(Employee $employee, int $branchId): bool
    {
        if ($this->isOrgWide()) {
            return true;
        }

        if ($this->isManager()) {
            return $this->managedBranchIds()->contains($branchId)
                && $employee->branches()->where('branches.id', $branchId)->exists();
        }

        $own = $this->ownEmployee();

        return $own && (int) $own->id === (int) $employee->id
            && $employee->branches()->where('branches.id', $branchId)->exists();
    }

    public function assertCanViewAny(): void
    {
        if (! $this->canViewAny()) {
            throw new AuthorizationException('Bạn không có quyền xem chấm công.');
        }
    }

    public function assertCanManage(): void
    {
        if (! $this->canManage()) {
            throw new AuthorizationException('Bạn không có quyền quản lý chấm công.');
        }
    }

    public function assertCanDelete(): void
    {
        if (! $this->canDelete()) {
            throw new AuthorizationException('Bạn không có quyền xoá bản ghi chấm công.');
        }
    }

    public function assertCanAccessBranch(?int $branchId): void
    {
        if (! $this->canAccessBranch($branchId)) {
            throw new AuthorizationException('Bạn không có quyền thao tác chi nhánh này.');
        }
    }

    public function assertCanViewLog(AttendanceLog $log): void
    {
        if (! $this->canViewLog($log)) {
            throw new AuthorizationException('Bạn không có quyền xem bản ghi này.');
        }
    }

    public function assertCanCheckFor(Employee $employee, int $branchId): void
    {
        if (! $this->canCheckFor($employee, $branchId)) {
            throw new AuthorizationException('Bạn không có quyền chấm công cho nhân viên này.');
        }
    }
}
