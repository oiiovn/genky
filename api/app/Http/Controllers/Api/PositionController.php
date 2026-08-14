<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Employee\StorePositionRequest;
use App\Models\OrganizationUser;
use App\Models\Position;
use App\Services\Employee\PositionService;
use App\Support\Tenancy\TenantContext;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PositionController extends Controller
{
    public function __construct(private readonly PositionService $positions)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $items = $this->positions
            ->list($request->boolean('active_only'))
            ->map(fn (Position $p) => $this->positions->payload($p));

        return response()->json(['data' => $items]);
    }

    public function store(StorePositionRequest $request): JsonResponse
    {
        $this->assertCanManage();
        $position = $this->positions->create($request->validated());

        return response()->json([
            'data' => $this->positions->payload($position),
        ], 201);
    }

    public function update(StorePositionRequest $request, int $position): JsonResponse
    {
        $this->assertCanManage();
        $model = Position::query()->findOrFail($position);
        $updated = $this->positions->update($model, $request->validated());

        return response()->json([
            'data' => $this->positions->payload($updated),
        ]);
    }

    public function destroy(int $position): JsonResponse
    {
        $this->assertCanManage();
        $model = Position::query()->findOrFail($position);
        $this->positions->delete($model);

        return response()->json(['message' => 'Đã xoá chức vụ.']);
    }

    protected function assertCanManage(): void
    {
        $role = auth()->user()?->roleIn(TenantContext::organization());

        if (! in_array($role, [
            OrganizationUser::ROLE_OWNER,
            OrganizationUser::ROLE_ADMIN,
            OrganizationUser::ROLE_HR,
        ], true)) {
            throw new AuthorizationException('Bạn không có quyền quản lý chức vụ.');
        }
    }
}
