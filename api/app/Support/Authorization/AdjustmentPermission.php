<?php

namespace App\Support\Authorization;

use App\Models\Employee;
use App\Models\EmployeeAdjustment;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Collection;

class AdjustmentPermission
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
        $org = TenantContext::organization();
        if ($org && (int) $org->owner_id === (int) $this->user->id) {
            return true;
        }

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
        return $this->role() === OrganizationUser::ROLE_EMPLOYEE && ! $this->isOrgWide();
    }

    public function canManage(): bool
    {
        return $this->isOrgWide() || $this->isManager();
    }

    public function canViewAny(): bool
    {
        return $this->canManage() || $this->role() === OrganizationUser::ROLE_EMPLOYEE;
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
            throw new AuthorizationException('Bạn không có quyền xem thưởng / phạt.');
        }
    }

    public function assertCanManage(): void
    {
        if (! $this->canManage()) {
            throw new AuthorizationException('Bạn không có quyền quản lý thưởng / phạt.');
        }
    }

    public function assertCanAccessEmployee(Employee $employee): void
    {
        if ($this->isOrgWide()) {
            return;
        }

        if ($this->isManager()) {
            $managed = $this->managedBranchIds();
            $employee->loadMissing('branches');
            if ($employee->branches->pluck('id')->intersect($managed)->isNotEmpty()) {
                return;
            }
        }

        throw new AuthorizationException('Bạn không có quyền thao tác nhân viên này.');
    }

    public function assertCanView(EmployeeAdjustment $row): void
    {
        if ($this->canManage()) {
            $row->loadMissing('employee');
            if ($row->employee) {
                $this->assertCanAccessEmployee($row->employee);
            }

            return;
        }

        $own = $this->ownEmployee();
        if ($own && (int) $own->id === (int) $row->employee_id) {
            return;
        }

        throw new AuthorizationException('Bạn không có quyền xem bản ghi này.');
    }
}
