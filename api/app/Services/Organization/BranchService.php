<?php

namespace App\Services\Organization;

use App\Models\Branch;
use App\Models\OrganizationUser;
use App\Models\User;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BranchService
{
    public function __construct(private readonly OrganizationService $organizations)
    {
    }

    /**
     * @return Collection<int, Branch>
     */
    public function list(): Collection
    {
        // organization_id lấy từ TenantContext — không nhận từ query client
        return Branch::query()
            ->orderByDesc('is_headquarters')
            ->orderBy('name')
            ->get();
    }

    public function findOrFail(int $id): Branch
    {
        return Branch::query()->findOrFail($id);
    }

    public function create(array $data): Branch
    {
        $this->assertCanManage();

        return DB::transaction(function () use ($data) {
            /** @var \App\Models\User $user */
            $user = auth()->user();
            $organization = $user->currentOrganization
                ?? $user->organizations()->orderByPivot('is_default', 'desc')->first();

            if (! $organization) {
                throw ValidationException::withMessages([
                    'organization' => ['Không xác định được tổ chức hiện tại.'],
                ]);
            }

            TenantContext::set($organization);

            $isFirst = Branch::query()->where('organization_id', $organization->id)->count() === 0;

            $branch = Branch::query()->create([
                'organization_id' => $organization->id,
                'name' => $data['name'],
                'phone' => $data['phone'] ?? $organization->phone,
                'address' => $data['address'] ?? null,
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
                'check_in_radius_meters' => $data['check_in_radius_meters'] ?? 100,
                'is_active' => true,
                'is_headquarters' => $data['is_headquarters'] ?? $isFirst,
            ]);

            if ($isFirst || empty($organization->setup_completed_at)) {
                $organization->forceFill([
                    'setup_completed_at' => now(),
                ])->save();
                TenantContext::set($organization->fresh());

                app(\App\Services\Employee\PositionService::class)
                    ->seedDefaults($organization);
                app(\App\Services\Shift\ShiftService::class)
                    ->seedDefaults($organization);
                app(\App\Services\Role\RoleService::class)
                    ->seedDefaults($organization);
            }

            return $branch;
        });
    }

    public function update(Branch $branch, array $data): Branch
    {
        $this->assertCanManage();
        $this->assertSameTenant($branch);

        $branch->fill(collect($data)->only([
            'name',
            'phone',
            'address',
            'latitude',
            'longitude',
            'check_in_radius_meters',
            'is_active',
            'is_headquarters',
        ])->all());

        $branch->save();

        return $branch->fresh();
    }

    public function delete(Branch $branch): void
    {
        $this->assertCanManage();
        $this->assertSameTenant($branch);

        if ($branch->is_headquarters && Branch::query()->count() === 1) {
            throw ValidationException::withMessages([
                'branch' => ['Không thể xoá chi nhánh duy nhất của tổ chức.'],
            ]);
        }

        $branch->delete();
    }

    public function payload(Branch $branch): array
    {
        return [
            'id' => $branch->id,
            'organization_id' => $branch->organization_id,
            'name' => $branch->name,
            'phone' => $branch->phone,
            'address' => $branch->address,
            'latitude' => $branch->latitude,
            'longitude' => $branch->longitude,
            'check_in_radius_meters' => $branch->check_in_radius_meters,
            'is_active' => $branch->is_active,
            'is_headquarters' => $branch->is_headquarters,
            'created_at' => $branch->created_at?->toIso8601String(),
            'updated_at' => $branch->updated_at?->toIso8601String(),
        ];
    }

    protected function assertSameTenant(Branch $branch): void
    {
        if ((int) $branch->organization_id !== (int) TenantContext::id()) {
            throw new AuthorizationException('Chi nhánh không thuộc tổ chức hiện tại.');
        }
    }

    protected function assertCanManage(): void
    {
        /** @var User|null $user */
        $user = auth()->user();
        $organization = $this->organizations->current();
        $role = $user?->roleIn($organization);

        if (! in_array($role, [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
            OrganizationUser::ROLE_MANAGER,
        ], true)) {
            throw new AuthorizationException('Bạn không có quyền quản lý chi nhánh.');
        }
    }
}
