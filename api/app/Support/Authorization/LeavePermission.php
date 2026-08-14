<?php

namespace App\Support\Authorization;

use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;

class LeavePermission
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

    public function canReview(): bool
    {
        $org = TenantContext::organization();
        if ($org && (int) $org->owner_id === (int) $this->user->id) {
            return true;
        }

        return in_array($this->role(), [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
            OrganizationUser::ROLE_HR,
            OrganizationUser::ROLE_MANAGER,
        ], true);
    }

    public function ownEmployee(): ?Employee
    {
        return Employee::query()->where('user_id', $this->user->id)->first();
    }

    public function assertCanCreate(): Employee
    {
        $employee = $this->ownEmployee();

        if (! $employee) {
            throw new AuthorizationException('Tài khoản chưa gắn hồ sơ nhân viên.');
        }

        return $employee;
    }

    public function assertCanView(LeaveRequest $leave): void
    {
        if ($this->canReview()) {
            return;
        }

        $own = $this->ownEmployee();
        if ($own && (int) $own->id === (int) $leave->employee_id) {
            return;
        }

        throw new AuthorizationException('Bạn không có quyền xem đơn nghỉ này.');
    }

    public function assertCanReview(): void
    {
        if (! $this->canReview()) {
            throw new AuthorizationException('Bạn không có quyền duyệt nghỉ phép.');
        }
    }
}
