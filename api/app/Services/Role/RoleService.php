<?php

namespace App\Services\Role;

use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Role;
use App\Models\RolePermission;
use App\Models\User;
use App\Support\Authorization\RoleManagePermission;
use App\Support\Role\RolePermissionCatalog;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class RoleService
{
    public function seedDefaults(?Organization $organization = null): void
    {
        $organization ??= TenantContext::organization();
        if (! $organization) {
            return;
        }

        $previous = TenantContext::organization();
        $switched = ! $previous || $previous->id !== $organization->id;
        if ($switched) {
            TenantContext::set($organization);
        }

        try {
            foreach (RolePermissionCatalog::defaultRoles() as $def) {
                $role = Role::query()->firstOrCreate(
                    [
                        'organization_id' => $organization->id,
                        'slug' => $def['slug'],
                    ],
                    [
                        'name' => $def['name'],
                        'description' => $def['description'],
                        'icon' => $def['icon'],
                        'color' => $def['color'],
                        'bg' => $def['bg'],
                        'is_system' => $def['is_system'],
                        'is_default' => $def['is_default'],
                        'sort_order' => $def['sort_order'],
                    ]
                );

                if ($role->wasRecentlyCreated || $role->permissions()->count() === 0) {
                    $this->syncPermissionRows($role, $def['permissions']);
                }
            }

            $ownerRole = Role::query()
                ->where('organization_id', $organization->id)
                ->where('slug', 'owner')
                ->first();

            if ($ownerRole && $organization->owner_id) {
                $exists = DB::table('role_user')
                    ->where('role_id', $ownerRole->id)
                    ->where('user_id', $organization->owner_id)
                    ->exists();

                if (! $exists) {
                    DB::table('role_user')->insert([
                        'organization_id' => $organization->id,
                        'role_id' => $ownerRole->id,
                        'user_id' => $organization->owner_id,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        } finally {
            if ($switched) {
                TenantContext::set($previous);
            }
        }
    }

    /**
     * @return Collection<int, Role>
     */
    public function list(): Collection
    {
        RoleManagePermission::for()->assertCanManage();
        $this->seedDefaults();

        return Role::query()
            ->withCount(['employees', 'users'])
            ->with('permissions')
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
    }

    public function findOrFail(int $id): Role
    {
        RoleManagePermission::for()->assertCanManage();
        $this->seedDefaults();

        return Role::query()->withCount(['employees', 'users'])->with('permissions')->findOrFail($id);
    }

    public function create(array $data): Role
    {
        RoleManagePermission::for()->assertCanManage();
        $this->seedDefaults();

        $name = trim($data['name']);
        $slug = $this->uniqueSlug(Str::slug($name) ?: 'role');

        return DB::transaction(function () use ($data, $name, $slug) {
            $role = Role::query()->create([
                'slug' => $slug,
                'name' => $name,
                'description' => trim((string) ($data['description'] ?? '')) ?: 'Chưa có mô tả',
                'icon' => $data['icon'] ?? 'user',
                'color' => $data['color'] ?? 'text-slate-600',
                'bg' => $data['bg'] ?? 'bg-slate-100',
                'is_system' => false,
                'is_default' => false,
                'sort_order' => (int) (Role::query()->max('sort_order') ?? 0) + 1,
            ]);

            if (isset($data['permissions']) && is_array($data['permissions'])) {
                $matrix = $this->normalizePermissionsInput($data['permissions']);
            } else {
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
            }

            $this->syncPermissionRows($role, $matrix);

            return $role->fresh(['permissions'])->loadCount('employees');
        });
    }

    public function update(Role $role, array $data): Role
    {
        RoleManagePermission::for()->assertCanManage();

        if ($role->is_default || ($role->is_system && $role->slug === 'owner')) {
            throw ValidationException::withMessages([
                'role' => ['Không thể sửa thông tin vai trò mặc định Chủ quán.'],
            ]);
        }

        $role->fill(collect($data)->only([
            'name',
            'description',
            'icon',
            'color',
            'bg',
        ])->filter(fn ($v) => $v !== null)->all());

        if (isset($data['name'])) {
            $role->name = trim($data['name']);
        }
        if (array_key_exists('description', $data)) {
            $role->description = trim((string) $data['description']) ?: 'Chưa có mô tả';
        }

        $role->save();

        return $role->fresh(['permissions'])->loadCount('employees');
    }

    public function delete(Role $role): void
    {
        RoleManagePermission::for()->assertCanManage();

        if ($role->is_system || $role->is_default) {
            throw ValidationException::withMessages([
                'role' => ['Không thể xoá vai trò hệ thống.'],
            ]);
        }

        $role->delete();
    }

    /**
     * @param  array<string, array<string, bool>>  $permissions
     */
    public function updatePermissions(Role $role, array $permissions): Role
    {
        RoleManagePermission::for()->assertCanManage();

        if ($role->is_default || $role->slug === 'owner') {
            throw ValidationException::withMessages([
                'role' => ['Không thể thay đổi quyền của vai trò Chủ quán.'],
            ]);
        }

        $normalized = $this->normalizePermissionsInput($permissions);
        $this->syncPermissionRows($role, $normalized);

        return $role->fresh(['permissions'])->loadCount('employees');
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function members(Role $role): array
    {
        RoleManagePermission::for()->assertCanManage();

        return $role->employees()
            ->with(['user'])
            ->orderBy('full_name')
            ->get()
            ->map(fn ($employee) => [
                'id' => $employee->id,
                'employee_id' => $employee->id,
                'user_id' => $employee->user_id,
                'name' => $employee->full_name,
                'employee_code' => $employee->employee_code,
                'email' => $employee->email,
                'has_user_account' => $employee->user_id !== null,
            ])
            ->all();
    }

    public function attachMember(Role $role, int $userId): Role
    {
        RoleManagePermission::for()->assertCanManage();
        $org = TenantContext::organization();
        if (! $org) {
            throw ValidationException::withMessages(['organization' => ['Chưa chọn tổ chức.']]);
        }

        $membership = OrganizationUser::query()
            ->where('organization_id', $org->id)
            ->where('user_id', $userId)
            ->first();

        if (! $membership) {
            throw ValidationException::withMessages([
                'user_id' => ['Người dùng không thuộc tổ chức này.'],
            ]);
        }

        $role->users()->syncWithoutDetaching([
            $userId => ['organization_id' => $org->id],
        ]);

        return $role->fresh(['permissions'])->loadCount('employees');
    }

    public function detachMember(Role $role, int $userId): Role
    {
        RoleManagePermission::for()->assertCanManage();

        if ($role->slug === 'owner') {
            $org = TenantContext::organization();
            if ($org && (int) $org->owner_id === $userId) {
                throw ValidationException::withMessages([
                    'user_id' => ['Không thể gỡ chủ quán khỏi vai trò mặc định.'],
                ]);
            }
        }

        $role->users()->detach($userId);

        // Keep employee.role_id in sync when detaching login membership
        \App\Models\Employee::query()
            ->where('user_id', $userId)
            ->where('role_id', $role->id)
            ->update(['role_id' => null]);

        return $role->fresh(['permissions'])->loadCount('employees');
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(Role $role): array
    {
        $role->loadMissing('permissions');
        if (! isset($role->employees_count)) {
            $role->loadCount('employees');
        }
        if (! isset($role->users_count)) {
            $role->loadCount('users');
        }

        return [
            'id' => $role->id,
            'slug' => $role->slug,
            'name' => $role->name,
            'description' => $role->description,
            'member_count' => max(
                (int) ($role->employees_count ?? 0),
                (int) ($role->users_count ?? 0),
            ),
            'is_default' => (bool) $role->is_default,
            'is_system' => (bool) $role->is_system,
            'icon' => $role->icon,
            'color' => $role->color,
            'bg' => $role->bg,
            'sort_order' => $role->sort_order,
            'permissions' => $this->permissionsMatrix($role),
        ];
    }

    /**
     * @return array<string, array{view: bool, create: bool, update: bool, delete: bool, export: bool}>
     */
    public function permissionsMatrix(Role $role): array
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
     * @param  array<string, array<string, bool>>  $permissions
     */
    protected function syncPermissionRows(Role $role, array $permissions): void
    {
        $allowedResources = RolePermissionCatalog::resourceActions();
        $rows = [];

        foreach ($permissions as $resource => $cell) {
            if (! isset($allowedResources[$resource])) {
                continue;
            }
            foreach ($allowedResources[$resource] as $action) {
                $allowed = (bool) ($cell[$action] ?? false);
                if (! $allowed) {
                    continue;
                }
                $rows[] = [
                    'role_id' => $role->id,
                    'resource' => $resource,
                    'action' => $action,
                    'allowed' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];
            }
        }

        RolePermission::query()->where('role_id', $role->id)->delete();
        if ($rows !== []) {
            RolePermission::query()->insert($rows);
        }
    }

    /**
     * @param  array<string, array<string, bool>>  $permissions
     * @return array<string, array{view: bool, create: bool, update: bool, delete: bool, export: bool}>
     */
    protected function normalizePermissionsInput(array $permissions): array
    {
        $normalized = [];
        foreach (RolePermissionCatalog::resourceActions() as $resource => $actions) {
            $cell = [
                'view' => false,
                'create' => false,
                'update' => false,
                'delete' => false,
                'export' => false,
            ];
            $input = $permissions[$resource] ?? [];
            foreach ($actions as $action) {
                $cell[$action] = (bool) ($input[$action] ?? false);
            }
            $normalized[$resource] = $cell;
        }

        return $normalized;
    }

    protected function uniqueSlug(string $base): string
    {
        $slug = Str::limit($base, 50, '');
        $candidate = $slug;
        $i = 2;
        while (Role::query()->where('slug', $candidate)->exists()) {
            $candidate = $slug.'-'.$i;
            $i++;
        }

        return $candidate;
    }
}
