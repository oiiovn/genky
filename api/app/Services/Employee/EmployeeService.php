<?php

namespace App\Services\Employee;

use App\Models\Branch;
use App\Models\Employee;
use App\Models\EmployeeBranch;
use App\Models\EmployeeInvitation;
use App\Models\Organization;
use App\Models\OrganizationUser;
use App\Models\Position;
use App\Models\Role;
use App\Models\User;
use App\Services\Auth\AuthService;
use App\Services\Role\RoleService;
use App\Support\Access\AccessCache;
use App\Support\Authorization\EmployeePermission;
use App\Support\Tenancy\TenantContext;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class EmployeeService
{
    public function __construct(private readonly PositionService $positions)
    {
    }

    public function list(array $filters = []): LengthAwarePaginator
    {
        return $this->scopedQuery($filters)
            ->with(['position', 'role', 'branches'])
            ->orderBy('full_name')
            ->paginate((int) ($filters['per_page'] ?? 20));
    }

    /**
     * @return array{total: int, active: int, resigned: int, inactive: int}
     */
    public function stats(array $filters = []): array
    {
        $row = $this->scopedQuery($filters)
            ->selectRaw('count(*) as total')
            ->selectRaw('sum(case when status = ? then 1 else 0 end) as active', [Employee::STATUS_ACTIVE])
            ->selectRaw('sum(case when status = ? then 1 else 0 end) as resigned', [Employee::STATUS_RESIGNED])
            ->selectRaw('sum(case when status = ? then 1 else 0 end) as inactive', [Employee::STATUS_INACTIVE])
            ->first();

        return [
            'total' => (int) ($row?->total ?? 0),
            'active' => (int) ($row?->active ?? 0),
            'resigned' => (int) ($row?->resigned ?? 0),
            'inactive' => (int) ($row?->inactive ?? 0),
        ];
    }

    public function findOrFail(int $id): Employee
    {
        $employee = Employee::query()
            ->with(['position', 'role', 'branches'])
            ->findOrFail($id);

        EmployeePermission::for()->assertCanView($employee);

        return $employee;
    }

    public function create(array $data): Employee
    {
        EmployeePermission::for()->assertCanCreate();

        return DB::transaction(function () use ($data) {
            $organization = TenantContext::organization();
            $this->positions->seedDefaults($organization);
            app(RoleService::class)->seedDefaults($organization);

            if (! empty($data['position_id'])) {
                Position::query()->findOrFail($data['position_id']);
            }

            $roleId = isset($data['role_id']) ? (int) $data['role_id'] : null;
            if ($roleId) {
                $this->assertRoleExists($roleId);
            }

            $branchIds = collect($data['branch_ids'] ?? [])->map(fn ($id) => (int) $id)->filter()->unique()->values();
            $primaryBranchId = isset($data['primary_branch_id'])
                ? (int) $data['primary_branch_id']
                : $branchIds->first();

            if ($branchIds->isNotEmpty()) {
                $this->assertBranchesExist($branchIds->all());
            }

            $permission = EmployeePermission::for();
            if ($permission->isManager()) {
                $managed = $permission->managedBranchIds();
                if ($branchIds->isEmpty() || $branchIds->diff($managed)->isNotEmpty()) {
                    throw ValidationException::withMessages([
                        'branch_ids' => ['Manager chỉ được gán nhân viên vào chi nhánh mình quản lý.'],
                    ]);
                }
            }

            $employee = Employee::query()->create([
                'organization_id' => $organization->id,
                'employee_code' => $data['employee_code'] ?? $this->nextEmployeeCode(),
                'full_name' => $data['full_name'],
                'phone' => $data['phone'] ?? null,
                'email' => isset($data['email']) ? mb_strtolower(trim($data['email'])) : null,
                'avatar' => $data['avatar'] ?? null,
                'gender' => $data['gender'] ?? null,
                'date_of_birth' => $data['date_of_birth'] ?? null,
                'address' => $data['address'] ?? null,
                'identity_number' => $data['identity_number'] ?? null,
                'position_id' => $data['position_id'] ?? null,
                'role_id' => $roleId,
                'employment_type' => $data['employment_type'] ?? 'full_time',
                'salary_type' => $data['salary_type'] ?? 'hourly',
                'salary_amount' => $data['salary_amount'] ?? 0,
                'joined_at' => $data['joined_at'] ?? now()->toDateString(),
                'status' => $data['status'] ?? Employee::STATUS_ACTIVE,
            ]);

            if ($branchIds->isNotEmpty()) {
                $this->syncBranches($employee, $branchIds->all(), $primaryBranchId);
            }

            $this->syncUserRoleAssignment($employee);

            return $employee->load(['position', 'role', 'branches']);
        });
    }

    public function update(Employee $employee, array $data): Employee
    {
        EmployeePermission::for()->assertCanUpdate($employee);

        return DB::transaction(function () use ($employee, $data) {
            if (array_key_exists('position_id', $data) && $data['position_id']) {
                Position::query()->findOrFail($data['position_id']);
            }

            if (array_key_exists('role_id', $data) && $data['role_id']) {
                $this->assertRoleExists((int) $data['role_id']);
            }

            $employee->fill(collect($data)->only([
                'full_name',
                'phone',
                'email',
                'avatar',
                'gender',
                'date_of_birth',
                'address',
                'identity_number',
                'position_id',
                'role_id',
                'employment_type',
                'salary_type',
                'salary_amount',
                'joined_at',
                'resigned_at',
                'status',
                'employee_code',
            ])->all());

            if (isset($data['email'])) {
                $employee->email = $data['email']
                    ? mb_strtolower(trim($data['email']))
                    : null;
            }

            // Employee role chỉ sửa hồ sơ cá nhân cơ bản — không đổi lương/status
            if (EmployeePermission::for()->isEmployeeOnly()) {
                $employee->fill(collect($data)->only([
                    'phone',
                    'avatar',
                    'address',
                    'gender',
                    'date_of_birth',
                    'identity_number',
                    'full_name',
                ])->all());
            }

            $employee->save();

            if (isset($data['branch_ids']) && ! EmployeePermission::for()->isEmployeeOnly()) {
                $branchIds = collect($data['branch_ids'])->map(fn ($id) => (int) $id)->filter()->unique()->values();
                $this->assertBranchesExist($branchIds->all());
                $primary = isset($data['primary_branch_id'])
                    ? (int) $data['primary_branch_id']
                    : $branchIds->first();
                $this->syncBranches($employee, $branchIds->all(), $primary);
            }

            $this->syncUserRoleAssignment($employee->fresh());

            return $employee->fresh(['position', 'role', 'branches']);
        });
    }

    public function delete(Employee $employee): void
    {
        EmployeePermission::for()->assertCanDelete($employee);
        $employee->delete();
    }

    public function assignBranch(Employee $employee, int $branchId, bool $isPrimary = false): Employee
    {
        EmployeePermission::for()->assertCanAssignBranch($employee);

        $branch = Branch::query()->findOrFail($branchId);

        $permission = EmployeePermission::for();
        if ($permission->isManager() && ! $permission->managedBranchIds()->contains($branch->id)) {
            throw ValidationException::withMessages([
                'branch_id' => ['Không thể gán chi nhánh ngoài phạm vi quản lý.'],
            ]);
        }

        return DB::transaction(function () use ($employee, $branch, $isPrimary) {
            if ($isPrimary) {
                EmployeeBranch::query()
                    ->where('employee_id', $employee->id)
                    ->update(['is_primary' => false]);
            }

            EmployeeBranch::query()->updateOrCreate(
                [
                    'employee_id' => $employee->id,
                    'branch_id' => $branch->id,
                ],
                [
                    'is_primary' => $isPrimary || ! $employee->branches()->exists(),
                    'assigned_at' => now(),
                ]
            );

            return $employee->fresh(['position', 'branches']);
        });
    }

    public function removeBranch(Employee $employee, int $branchId): Employee
    {
        EmployeePermission::for()->assertCanAssignBranch($employee);

        $pivot = EmployeeBranch::query()
            ->where('employee_id', $employee->id)
            ->where('branch_id', $branchId)
            ->firstOrFail();

        if ($employee->branches()->count() <= 1) {
            throw ValidationException::withMessages([
                'branch' => ['Nhân viên phải thuộc ít nhất một chi nhánh.'],
            ]);
        }

        $wasPrimary = $pivot->is_primary;
        $pivot->delete();

        if ($wasPrimary) {
            $next = EmployeeBranch::query()->where('employee_id', $employee->id)->first();
            if ($next) {
                $next->forceFill(['is_primary' => true])->save();
            }
        }

        return $employee->fresh(['position', 'branches']);
    }

    public function invite(Employee $employee, ?string $email = null): EmployeeInvitation
    {
        EmployeePermission::for()->assertCanInvite($employee);

        $email = mb_strtolower(trim($email ?: (string) $employee->email));

        if ($email === '') {
            throw ValidationException::withMessages([
                'email' => ['Nhân viên cần có email để gửi lời mời.'],
            ]);
        }

        if ($employee->user_id) {
            throw ValidationException::withMessages([
                'employee' => ['Nhân viên đã liên kết tài khoản Genky.'],
            ]);
        }

        if ($employee->email !== $email) {
            $employee->forceFill(['email' => $email])->save();
        }

        EmployeeInvitation::query()
            ->where('employee_id', $employee->id)
            ->whereNull('accepted_at')
            ->update(['expires_at' => now()]);

        return EmployeeInvitation::query()->create([
            'organization_id' => $employee->organization_id,
            'employee_id' => $employee->id,
            'invited_by' => auth()->id(),
            'email' => $email,
            'token' => Str::random(64),
            'expires_at' => now()->addDays(7),
        ]);
    }

    public function findInvitationByToken(string $token): EmployeeInvitation
    {
        $invitation = EmployeeInvitation::withoutGlobalScopes()
            ->where('token', $token)
            ->first();

        if (! $invitation) {
            throw ValidationException::withMessages([
                'token' => ['Link mời không hợp lệ.'],
            ]);
        }

        return $invitation;
    }

    public function invitationPreview(EmployeeInvitation $invitation): array
    {
        $employee = Employee::withoutGlobalScopes()->find($invitation->employee_id);
        $organization = Organization::query()->find($invitation->organization_id);

        return [
            'email' => $invitation->email,
            'expires_at' => $invitation->expires_at?->toIso8601String(),
            'is_valid' => $invitation->isValid(),
            'accepted' => $invitation->accepted_at !== null,
            'employee' => $employee ? [
                'full_name' => $employee->full_name,
                'employee_code' => $employee->employee_code,
            ] : null,
            'organization' => $organization ? [
                'id' => $organization->id,
                'name' => $organization->name,
            ] : null,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function acceptInvitation(string $token, array $data): array
    {
        return DB::transaction(function () use ($token, $data) {
            $invitation = EmployeeInvitation::withoutGlobalScopes()
                ->where('token', $token)
                ->lockForUpdate()
                ->first();

            if (! $invitation) {
                throw ValidationException::withMessages([
                    'token' => ['Link mời không hợp lệ.'],
                ]);
            }

            if ($invitation->accepted_at !== null) {
                throw ValidationException::withMessages([
                    'token' => ['Lời mời đã được chấp nhận.'],
                ]);
            }

            if ($invitation->expires_at === null || $invitation->expires_at->isPast()) {
                throw ValidationException::withMessages([
                    'token' => ['Lời mời đã hết hạn. Vui lòng nhờ quản lý gửi lại.'],
                ]);
            }

            $employee = Employee::withoutGlobalScopes()
                ->where('id', $invitation->employee_id)
                ->lockForUpdate()
                ->first();

            if (! $employee) {
                throw ValidationException::withMessages([
                    'token' => ['Không tìm thấy nhân viên của lời mời.'],
                ]);
            }

            if ($employee->user_id) {
                throw ValidationException::withMessages([
                    'token' => ['Nhân viên đã có tài khoản Genky.'],
                ]);
            }

            $organization = Organization::query()->find($invitation->organization_id);

            if (! $organization) {
                throw ValidationException::withMessages([
                    'token' => ['Tổ chức không còn tồn tại.'],
                ]);
            }

            $email = mb_strtolower(trim($invitation->email));
            $name = trim((string) ($data['name'] ?? '')) ?: $employee->full_name;
            $phone = isset($data['phone']) ? trim((string) $data['phone']) : ($employee->phone ?: null);

            $user = User::query()
                ->whereRaw('lower(email) = ?', [$email])
                ->first();

            if ($user) {
                if (! Hash::check($data['password'], $user->password)) {
                    throw ValidationException::withMessages([
                        'password' => ['Email đã có tài khoản. Nhập đúng mật khẩu hiện tại để liên kết.'],
                    ]);
                }

                $alreadyLinked = Employee::withoutGlobalScopes()
                    ->where('user_id', $user->id)
                    ->exists();

                if ($alreadyLinked) {
                    throw ValidationException::withMessages([
                        'email' => ['Tài khoản này đã gắn với nhân viên khác.'],
                    ]);
                }

                if (! $user->belongsToOrganization($organization->id)) {
                    OrganizationUser::query()->create([
                        'organization_id' => $organization->id,
                        'user_id' => $user->id,
                        'role' => OrganizationUser::ROLE_EMPLOYEE,
                        'is_default' => $user->current_organization_id === null,
                    ]);
                }
            } else {
                $user = User::query()->create([
                    'name' => $name,
                    'email' => $email,
                    'phone' => $phone,
                    'password' => $data['password'],
                    'current_organization_id' => $organization->id,
                ]);

                OrganizationUser::query()->create([
                    'organization_id' => $organization->id,
                    'user_id' => $user->id,
                    'role' => OrganizationUser::ROLE_EMPLOYEE,
                    'is_default' => true,
                ]);
            }

            $primaryBranchId = EmployeeBranch::query()
                ->where('employee_id', $employee->id)
                ->orderByDesc('is_primary')
                ->value('branch_id');

            $user->forceFill([
                'current_organization_id' => $organization->id,
                'current_branch_id' => $primaryBranchId,
                'name' => $user->name ?: $name,
            ])->save();

            $employee->forceFill([
                'user_id' => $user->id,
                'email' => $email,
            ])->save();

            $this->syncUserRoleAssignment($employee->fresh());

            $invitation->forceFill(['accepted_at' => now()])->save();

            return app(AuthService::class)->issueSession($user->fresh(), $organization);
        });
    }

    public function payload(Employee $employee): array
    {
        $employee->loadMissing(['position', 'role', 'branches']);

        return [
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
            'role' => $employee->role ? [
                'id' => $employee->role->id,
                'name' => $employee->role->name,
                'slug' => $employee->role->slug,
                'color' => $employee->role->color,
                'bg' => $employee->role->bg,
            ] : null,
            'position' => $employee->position ? [
                'id' => $employee->position->id,
                'name' => $employee->position->name,
            ] : null,
            'employment_type' => $employee->employment_type,
            'salary_type' => $employee->salary_type,
            'salary_amount' => $employee->salary_amount,
            'joined_at' => $employee->joined_at?->toDateString(),
            'resigned_at' => $employee->resigned_at?->toDateString(),
            'status' => $employee->status,
            'user_id' => $employee->user_id,
            'has_user_account' => $employee->user_id !== null,
            'branches' => $employee->branches->map(fn (Branch $branch) => [
                'id' => $branch->id,
                'name' => $branch->name,
                'is_primary' => (bool) $branch->pivot->is_primary,
                'assigned_at' => $branch->pivot->assigned_at,
            ])->values()->all(),
        ];
    }

    public function invitationPayload(EmployeeInvitation $invitation): array
    {
        return [
            'id' => $invitation->id,
            'employee_id' => $invitation->employee_id,
            'email' => $invitation->email,
            'token' => $invitation->token,
            'expires_at' => $invitation->expires_at?->toIso8601String(),
            'invite_url' => $this->frontendBaseUrl().'/invite/'.$invitation->token,
        ];
    }

    protected function frontendBaseUrl(): string
    {
        $configured = rtrim((string) config('app.frontend_url', ''), '/');
        if ($configured !== '' && ! $this->isLocalHostUrl($configured)) {
            return $configured;
        }

        $fromRequest = $this->publicOriginFromRequest();
        if ($fromRequest) {
            return $fromRequest;
        }

        $appUrl = rtrim((string) config('app.url', ''), '/');
        if ($appUrl !== '' && ! $this->isLocalHostUrl($appUrl)) {
            return $appUrl;
        }

        return $configured !== '' ? $configured : 'http://localhost:3000';
    }

    protected function isLocalHostUrl(string $url): bool
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));

        return in_array($host, ['localhost', '127.0.0.1', '::1', '0.0.0.0'], true);
    }

    protected function publicOriginFromRequest(): ?string
    {
        $raw = request()->headers->get('Origin')
            ?: request()->headers->get('Referer');

        if (! is_string($raw) || $raw === '') {
            return null;
        }

        $parts = parse_url($raw);
        if (! is_array($parts) || empty($parts['scheme']) || empty($parts['host'])) {
            return null;
        }

        $base = $parts['scheme'].'://'.$parts['host'];
        if ($this->isLocalHostUrl($base)) {
            return null;
        }

        $port = isset($parts['port']) ? (int) $parts['port'] : null;
        if ($port && ! in_array($port, [80, 443], true)) {
            $base .= ':'.$port;
        }

        return $base;
    }


    protected function assertRoleExists(int $roleId): void
    {
        if (! Role::query()->whereKey($roleId)->exists()) {
            throw ValidationException::withMessages([
                'role_id' => ['Vai trò không hợp lệ.'],
            ]);
        }
    }

    protected function syncUserRoleAssignment(Employee $employee): void
    {
        if (! $employee->user_id) {
            return;
        }

        $orgId = $employee->organization_id;
        DB::table('role_user')
            ->where('organization_id', $orgId)
            ->where('user_id', $employee->user_id)
            ->delete();

        if ($employee->role_id) {
            DB::table('role_user')->updateOrInsert(
                [
                    'role_id' => $employee->role_id,
                    'user_id' => $employee->user_id,
                ],
                [
                    'organization_id' => $orgId,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]
            );
        }

        AccessCache::bumpPermissions((int) $orgId);
    }

    protected function nextEmployeeCode(): string
    {
        $organizationId = TenantContext::id();
        $count = Employee::query()
            ->withoutGlobalScopes()
            ->where('organization_id', $organizationId)
            ->count();

        do {
            $count++;
            $code = 'NV'.str_pad((string) $count, 3, '0', STR_PAD_LEFT);
            $exists = Employee::query()
                ->withoutGlobalScopes()
                ->where('organization_id', $organizationId)
                ->where('employee_code', $code)
                ->exists();
        } while ($exists);

        return $code;
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    protected function scopedQuery(array $filters = [])
    {
        $permission = EmployeePermission::for();
        $permission->assertCanViewAny();

        $query = Employee::query();

        if ($permission->isEmployeeOnly()) {
            $query->where('user_id', auth()->id());
        } elseif ($permission->isManager()) {
            $branchIds = $permission->managedBranchIds();
            if ($branchIds->isEmpty()) {
                $query->whereRaw('0 = 1');
            } else {
                $query->whereHas('branches', fn ($q) => $q->whereIn('branches.id', $branchIds));
            }
        }

        if (! empty($filters['branch_id'])) {
            $query->whereHas('branches', fn ($q) => $q->where('branches.id', (int) $filters['branch_id']));
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['role_id'])) {
            $query->where('role_id', (int) $filters['role_id']);
        }

        if (! empty($filters['position_id'])) {
            $query->where('position_id', (int) $filters['position_id']);
        }

        if (! empty($filters['search'])) {
            $search = trim((string) $filters['search']);
            $like = '%'.mb_strtolower($search).'%';
            $query->where(function ($q) use ($like) {
                $q->whereRaw('lower(full_name) like ?', [$like])
                    ->orWhereRaw('lower(employee_code) like ?', [$like])
                    ->orWhereRaw('lower(coalesce(phone, "")) like ?', [$like])
                    ->orWhereRaw('lower(coalesce(email, "")) like ?', [$like]);
            });
        }

        return $query;
    }

    /**
     * @param  list<int>  $branchIds
     */
    protected function assertBranchesExist(array $branchIds): void
    {
        $found = Branch::query()->whereIn('id', $branchIds)->pluck('id');

        if ($found->count() !== count($branchIds)) {
            throw ValidationException::withMessages([
                'branch_ids' => ['Một hoặc nhiều chi nhánh không hợp lệ.'],
            ]);
        }
    }

    /**
     * @param  list<int>  $branchIds
     */
    protected function syncBranches(Employee $employee, array $branchIds, ?int $primaryBranchId): void
    {
        if ($primaryBranchId && ! in_array($primaryBranchId, $branchIds, true)) {
            $primaryBranchId = $branchIds[0] ?? null;
        }

        $sync = [];
        foreach ($branchIds as $branchId) {
            $sync[$branchId] = [
                'is_primary' => $primaryBranchId === $branchId,
                'assigned_at' => now(),
            ];
        }

        $employee->branches()->sync($sync);
    }
}
