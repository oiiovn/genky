<?php

namespace App\Http\Controllers\Api\Marketing;

use App\Http\Controllers\Controller;
use App\Http\Requests\Marketing\ReorderMarketingRewardsRequest;
use App\Http\Requests\Marketing\StoreMarketingRewardRequest;
use App\Http\Requests\Marketing\UpdateMarketingRewardRequest;
use App\Http\Requests\Marketing\UploadMarketingRewardImageRequest;
use App\Models\MarketingReward;
use App\Services\Marketing\MarketingRewardService;
use App\Support\Authorization\EffectivePermission;
use App\Support\Marketing\MarketingPermissionMap;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;

class MarketingRewardController extends Controller
{
    public function __construct(
        private readonly MarketingRewardService $rewards,
    ) {
    }

    public function index(): JsonResponse
    {
        $this->assertCanView();

        return response()->json([
            'data' => $this->rewards->list(),
        ]);
    }

    public function store(StoreMarketingRewardRequest $request): JsonResponse
    {
        $this->assertCanManage();

        $reward = $this->rewards->create($request->validated());

        return response()->json([
            'data' => $this->rewards->payload($reward),
            'message' => 'Đã thêm món tặng.',
        ], 201);
    }

    public function update(
        UpdateMarketingRewardRequest $request,
        int $id,
    ): JsonResponse {
        $this->assertCanManage();

        $reward = MarketingReward::query()->findOrFail($id);
        $reward = $this->rewards->update($reward, $request->validated());

        return response()->json([
            'data' => $this->rewards->payload($reward),
            'message' => 'Đã cập nhật món tặng.',
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $this->assertCanManage();

        $reward = MarketingReward::query()->findOrFail($id);
        $this->rewards->delete($reward);

        return response()->json([
            'message' => 'Đã xoá món tặng.',
        ]);
    }

    public function reorder(ReorderMarketingRewardsRequest $request): JsonResponse
    {
        $this->assertCanManage();

        $rows = $this->rewards->reorder($request->validated('ids'));

        return response()->json([
            'data' => $rows,
            'message' => 'Đã cập nhật thứ tự món.',
        ]);
    }

    public function seedDefaults(): JsonResponse
    {
        $this->assertCanManage();

        $rows = $this->rewards->seedDefaultsIfEmpty();

        return response()->json([
            'data' => $rows,
            'message' => count($rows) > 0
                ? 'Đã có danh sách món tặng.'
                : 'Không có món tặng.',
        ]);
    }

    public function uploadImage(
        UploadMarketingRewardImageRequest $request,
        int $id,
    ): JsonResponse {
        $this->assertCanManage();

        $reward = MarketingReward::query()->findOrFail($id);
        $reward = $this->rewards->uploadImage(
            $reward,
            $request->file('image'),
        );

        return response()->json([
            'data' => $this->rewards->payload($reward),
            'message' => 'Đã tải ảnh món.',
        ]);
    }

    public function clearImage(int $id): JsonResponse
    {
        $this->assertCanManage();

        $reward = MarketingReward::query()->findOrFail($id);
        $reward = $this->rewards->clearImage($reward);

        return response()->json([
            'data' => $this->rewards->payload($reward),
            'message' => 'Đã xoá ảnh món.',
        ]);
    }

    protected function assertCanView(): void
    {
        $perm = EffectivePermission::for();
        if (
            $perm->can(MarketingPermissionMap::SETTINGS, 'view')
            || $perm->can(MarketingPermissionMap::REWARD, 'view')
            || $perm->can(MarketingPermissionMap::REVIEW, 'view')
        ) {
            return;
        }

        throw new AuthorizationException('Bạn không có quyền xem món tặng.');
    }

    protected function assertCanManage(): void
    {
        $perm = EffectivePermission::for();
        if (
            $perm->can(MarketingPermissionMap::SETTINGS, 'update')
            || $perm->can(MarketingPermissionMap::REWARD, 'create')
            || $perm->can(MarketingPermissionMap::REVIEW, 'update')
        ) {
            return;
        }

        throw new AuthorizationException('Bạn không có quyền quản lý món tặng.');
    }
}
