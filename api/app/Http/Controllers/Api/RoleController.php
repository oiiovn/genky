<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Role\AttachRoleMemberRequest;
use App\Http\Requests\Role\StoreRoleRequest;
use App\Http\Requests\Role\UpdateRolePermissionsRequest;
use App\Http\Requests\Role\UpdateRoleRequest;
use App\Services\Role\RoleService;
use App\Support\Role\RolePermissionCatalog;
use Illuminate\Http\JsonResponse;

class RoleController extends Controller
{
    public function __construct(private readonly RoleService $roles)
    {
    }

    public function catalog(): JsonResponse
    {
        return response()->json([
            'data' => [
                'actions' => collect(RolePermissionCatalog::ACTIONS)->map(fn ($a) => [
                    'key' => $a,
                    'label' => match ($a) {
                        'view' => 'Xem',
                        'create' => 'Thêm',
                        'update' => 'Sửa',
                        'delete' => 'Xóa',
                        'export' => 'Xuất',
                        default => $a,
                    },
                ])->values(),
                'groups' => RolePermissionCatalog::groups(),
            ],
        ]);
    }

    public function index(): JsonResponse
    {
        $roles = $this->roles->list();

        return response()->json([
            'data' => $roles->map(fn ($role) => $this->roles->payload($role))->values(),
        ]);
    }

    public function store(StoreRoleRequest $request): JsonResponse
    {
        $role = $this->roles->create($request->validated());

        return response()->json([
            'data' => $this->roles->payload($role),
        ], 201);
    }

    public function show(int $role): JsonResponse
    {
        $model = $this->roles->findOrFail($role);

        return response()->json([
            'data' => $this->roles->payload($model),
        ]);
    }

    public function update(UpdateRoleRequest $request, int $role): JsonResponse
    {
        $model = $this->roles->findOrFail($role);
        $updated = $this->roles->update($model, $request->validated());

        return response()->json([
            'data' => $this->roles->payload($updated),
        ]);
    }

    public function destroy(int $role): JsonResponse
    {
        $model = $this->roles->findOrFail($role);
        $this->roles->delete($model);

        return response()->json(['message' => 'Đã xoá vai trò.']);
    }

    public function updatePermissions(UpdateRolePermissionsRequest $request, int $role): JsonResponse
    {
        $model = $this->roles->findOrFail($role);
        $updated = $this->roles->updatePermissions(
            $model,
            $request->validated()['permissions']
        );

        return response()->json([
            'data' => $this->roles->payload($updated),
        ]);
    }

    public function members(int $role): JsonResponse
    {
        $model = $this->roles->findOrFail($role);

        return response()->json([
            'data' => $this->roles->members($model),
        ]);
    }

    public function attachMember(AttachRoleMemberRequest $request, int $role): JsonResponse
    {
        $model = $this->roles->findOrFail($role);
        $updated = $this->roles->attachMember($model, (int) $request->validated()['user_id']);

        return response()->json([
            'data' => $this->roles->payload($updated),
        ]);
    }

    public function detachMember(int $role, int $user): JsonResponse
    {
        $model = $this->roles->findOrFail($role);
        $updated = $this->roles->detachMember($model, $user);

        return response()->json([
            'data' => $this->roles->payload($updated),
        ]);
    }
}
