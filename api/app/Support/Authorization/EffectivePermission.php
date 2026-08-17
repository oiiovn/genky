<?php

namespace App\Support\Authorization;

use App\Models\Employee;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Role;
use App\Models\User;
use App\Support\Access\AccessCache;
use App\Support\Marketing\MarketingPermissionMap;
use App\Support\Role\RolePermissionCatalog;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;

class EffectivePermission
{
    /** @var array<string, array{view: bool, create: bool, update: bool, delete: bool, export: bool}> */
    protected array $matrix;

    protected ?Role $customRole;

    protected bool $bypass;

    protected string $roleLabel;

    protected ?string $membershipRole;

    public function __construct(
        protected User $user,
        array $matrix,
        ?Role $customRole,
        bool $bypass,
        string $roleLabel,
        ?string $membershipRole,
    ) {
        $this->matrix = $matrix;
        $this->customRole = $customRole;
        $this->bypass = $bypass;
        $this->roleLabel = $roleLabel;
        $this->membershipRole = $membershipRole;
    }

    public static function for(?User $user = null): self
    {
        $user ??= auth()->user();

        if (! $user) {
            throw new AuthorizationException('Chưa đăng nhập.');
        }

        $org = TenantContext::organization();
        $orgId = (int) ($org?->id ?? 0);

        return AccessCache::rememberRequest(
            "perm:{$user->id}:{$orgId}",
            function () use ($user, $org, $orgId) {
                if ($orgId === 0) {
                    return self::resolve($user, $org);
                }

                $snapshot = AccessCache::rememberPermission(
                    (int) $user->id,
                    $orgId,
                    fn () => self::resolve($user, $org)->snapshot()
                );

                return self::fromSnapshot($user, $snapshot);
            }
        );
    }

    public static function resolve(?User $user = null, ?Organization $org = null): self
    {
        $user ??= auth()->user();

        if (! $user) {
            throw new AuthorizationException('Chưa đăng nhập.');
        }

        $org ??= TenantContext::organization();
        $membershipRole = $user->roleIn($org);

        $bypass = in_array($membershipRole, [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
        ], true) || ($org && (int) $org->owner_id === (int) $user->id);

        $customRole = null;
        if ($org) {
            $employee = Employee::query()
                ->where('user_id', $user->id)
                ->first();

            if ($employee?->role_id) {
                $customRole = Role::query()->with('permissions')->find($employee->role_id);
            }

            if (! $customRole) {
                $roleId = DB::table('role_user')
                    ->where('organization_id', $org->id)
                    ->where('user_id', $user->id)
                    ->value('role_id');
                if ($roleId) {
                    $customRole = Role::query()->with('permissions')->find($roleId);
                }
            }
        }

        if ($customRole?->is_default || $customRole?->slug === 'owner') {
            $bypass = true;
        }

        if ($bypass) {
            $matrix = RolePermissionCatalog::fullMatrix();
            // Ensure new system resources are fully granted
            foreach (RolePermissionCatalog::resourceActions() as $resource => $actions) {
                foreach ($actions as $action) {
                    $matrix[$resource][$action] = true;
                }
            }

            return new self(
                $user,
                $matrix,
                $customRole,
                true,
                $customRole?->name
                    ?? match ($membershipRole) {
                        OrganizationUser::ROLE_OWNER => 'Chủ cửa hàng',
                        OrganizationUser::ROLE_ADMIN => 'Quản trị viên',
                        default => 'Chủ cửa hàng',
                    },
                $membershipRole,
            );
        }

        if ($customRole) {
            $matrix = self::matrixFromRole($customRole);

            return new self(
                $user,
                $matrix,
                $customRole,
                false,
                $customRole->name,
                $membershipRole,
            );
        }

        // Legacy fallback without custom role
        $matrix = self::legacyMatrix($membershipRole);

        return new self(
            $user,
            $matrix,
            null,
            false,
            match ($membershipRole) {
                OrganizationUser::ROLE_OWNER => 'Chủ cửa hàng',
                OrganizationUser::ROLE_ADMIN => 'Quản trị viên',
                OrganizationUser::ROLE_MANAGER => 'Quản lý',
                OrganizationUser::ROLE_HR => 'Nhân sự',
                OrganizationUser::ROLE_EMPLOYEE => 'Nhân viên',
                default => 'Thành viên',
            },
            $membershipRole,
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function snapshot(): array
    {
        return [
            'matrix' => $this->matrix,
            'bypass' => $this->bypass,
            'roleLabel' => $this->roleLabel,
            'membershipRole' => $this->membershipRole,
            'customRole' => $this->customRole ? [
                'id' => $this->customRole->id,
                'slug' => $this->customRole->slug,
                'name' => $this->customRole->name,
                'is_default' => (bool) $this->customRole->is_default,
            ] : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $snapshot
     */
    public static function fromSnapshot(User $user, array $snapshot): self
    {
        $customRole = null;
        if (is_array($snapshot['customRole'] ?? null)) {
            $customRole = (new Role)->forceFill($snapshot['customRole']);
            $customRole->exists = true;
        }

        return new self(
            $user,
            $snapshot['matrix'] ?? [],
            $customRole,
            (bool) ($snapshot['bypass'] ?? false),
            (string) ($snapshot['roleLabel'] ?? 'Thành viên'),
            isset($snapshot['membershipRole']) ? (string) $snapshot['membershipRole'] : null,
        );
    }

    public function can(string $resource, string $action = 'view'): bool
    {
        if ($this->bypass) {
            return true;
        }

        if ($this->staffCanHandleGiftCode($resource, $action)) {
            return true;
        }

        return (bool) ($this->matrix[$resource][$action] ?? false);
    }

    /**
     * Nhân viên (app staff) luôn kiểm tra mã và xác nhận tặng tại quầy.
     */
    protected function staffCanHandleGiftCode(string $resource, string $action): bool
    {
        if ($this->membershipRole !== OrganizationUser::ROLE_EMPLOYEE) {
            return false;
        }

        return match ($resource) {
            MarketingPermissionMap::REWARD => $action === 'view',
            MarketingPermissionMap::REDEMPTION => in_array($action, ['view', 'create'], true),
            default => false,
        };
    }

    public function assertCan(string $resource, string $action = 'view', ?string $message = null): void
    {
        if (! $this->can($resource, $action)) {
            throw new AuthorizationException(
                $message ?? 'Bạn không có quyền thực hiện thao tác này.'
            );
        }
    }

    public function isBypass(): bool
    {
        return $this->bypass;
    }

    public function isOrgWide(): bool
    {
        if ($this->bypass) {
            return true;
        }

        if (in_array($this->membershipRole, [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
            OrganizationUser::ROLE_HR,
            OrganizationUser::ROLE_MANAGER,
        ], true)) {
            return true;
        }

        // Custom role with employee management = org/branch wide ops
        return $this->can('employees', 'view');
    }

    public function isEmployeeOnly(): bool
    {
        return ! $this->isOrgWide();
    }

    public function roleLabel(): string
    {
        return $this->roleLabel;
    }

    public function customRole(): ?Role
    {
        return $this->customRole;
    }

    public function membershipRole(): ?string
    {
        return $this->membershipRole;
    }

    /**
     * @return array<string, array{view: bool, create: bool, update: bool, delete: bool, export: bool}>
     */
    public function matrix(): array
    {
        return $this->matrix;
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(): array
    {
        $employee = Employee::query()
            ->with(['branches', 'position', 'role'])
            ->where('user_id', $this->user->id)
            ->first();

        return [
            'role_label' => $this->roleLabel,
            'membership_role' => $this->membershipRole,
            'is_owner' => $this->bypass,
            'custom_role' => $this->customRole ? [
                'id' => $this->customRole->id,
                'slug' => $this->customRole->slug,
                'name' => $this->customRole->name,
                'is_default' => (bool) $this->customRole->is_default,
            ] : null,
            'employee_id' => $employee?->id,
            'employee' => $employee ? [
                'id' => $employee->id,
                'employee_code' => $employee->employee_code,
                'full_name' => $employee->full_name,
                'phone' => $employee->phone,
                'email' => $employee->email,
                'avatar' => $employee->resolvedAvatarUrl(),
                'gender' => $employee->gender,
                'date_of_birth' => $employee->date_of_birth?->toDateString(),
                'address' => $employee->address,
                'identity_number' => $employee->identity_number,
                'joined_at' => $employee->joined_at?->toDateString(),
                'position' => $employee->position ? [
                    'id' => $employee->position->id,
                    'name' => $employee->position->name,
                ] : null,
                'role' => $employee->role ? [
                    'id' => $employee->role->id,
                    'name' => $employee->role->name,
                    'slug' => $employee->role->slug,
                ] : null,
                'branches' => $employee->branches->map(fn ($b) => [
                    'id' => $b->id,
                    'name' => $b->name,
                    'is_primary' => (bool) $b->pivot->is_primary,
                ])->values()->all(),
            ] : null,
            'permissions' => $this->matrix,
        ];
    }

    /**
     * @return array<string, array{view: bool, create: bool, update: bool, delete: bool, export: bool}>
     */
    protected static function matrixFromRole(Role $role): array
    {
        $matrix = [];
        foreach (RolePermissionCatalog::resourceActions() as $resource => $_actions) {
            $matrix[$resource] = [
                'view' => false,
                'create' => false,
                'update' => false,
                'delete' => false,
                'export' => false,
            ];
        }

        foreach ($role->permissions as $perm) {
            if (! isset($matrix[$perm->resource])) {
                $matrix[$perm->resource] = [
                    'view' => false,
                    'create' => false,
                    'update' => false,
                    'delete' => false,
                    'export' => false,
                ];
            }
            if (in_array($perm->action, RolePermissionCatalog::ACTIONS, true)) {
                $matrix[$perm->resource][$perm->action] = (bool) $perm->allowed;
            }
        }

        return $matrix;
    }

    /**
     * @return array<string, array{view: bool, create: bool, update: bool, delete: bool, export: bool}>
     */
    protected static function legacyMatrix(?string $membershipRole): array
    {
        $empty = [];
        foreach (RolePermissionCatalog::resourceActions() as $resource => $_actions) {
            $empty[$resource] = [
                'view' => false,
                'create' => false,
                'update' => false,
                'delete' => false,
                'export' => false,
            ];
        }

        if (in_array($membershipRole, [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
        ], true)) {
            return RolePermissionCatalog::fullMatrix();
        }

        if (in_array($membershipRole, [
            OrganizationUser::ROLE_HR,
            OrganizationUser::ROLE_MANAGER,
        ], true)) {
            $matrix = RolePermissionCatalog::fullMatrix([
                'settings' => ['view' => false, 'update' => false],
                'roles' => [
                    'view' => $membershipRole === OrganizationUser::ROLE_HR,
                    'create' => $membershipRole === OrganizationUser::ROLE_HR,
                    'update' => $membershipRole === OrganizationUser::ROLE_HR,
                    'delete' => false,
                ],
            ]);

            return $matrix;
        }

        // Plain employee without custom role: no module access
        return $empty;
    }
}
