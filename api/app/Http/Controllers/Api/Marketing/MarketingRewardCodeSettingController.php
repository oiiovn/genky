<?php

namespace App\Http\Controllers\Api\Marketing;

use App\Http\Controllers\Controller;
use App\Http\Requests\Marketing\UpdateMarketingRewardCodeSettingRequest;
use App\Services\Marketing\MarketingRewardCodeSettingService;
use App\Support\Authorization\EffectivePermission;
use App\Support\Marketing\MarketingPermissionMap;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;

class MarketingRewardCodeSettingController extends Controller
{
    public function __construct(
        private readonly MarketingRewardCodeSettingService $settings,
    ) {
    }

    public function show(): JsonResponse
    {
        $this->assertCanView();

        return response()->json([
            'data' => $this->settings->show(),
        ]);
    }

    public function update(UpdateMarketingRewardCodeSettingRequest $request): JsonResponse
    {
        $this->assertCanManage();

        return response()->json([
            'data' => $this->settings->update($request->validated()),
            'message' => 'Đã lưu cấu hình mã tặng.',
        ]);
    }

    protected function assertCanView(): void
    {
        $perm = EffectivePermission::for();
        if (
            $perm->can(MarketingPermissionMap::SETTINGS, 'view')
            || $perm->can(MarketingPermissionMap::REVIEW, 'view')
        ) {
            return;
        }

        throw new AuthorizationException('Bạn không có quyền xem cấu hình mã tặng.');
    }

    protected function assertCanManage(): void
    {
        $perm = EffectivePermission::for();
        if (
            $perm->can(MarketingPermissionMap::SETTINGS, 'update')
            || $perm->can(MarketingPermissionMap::REVIEW, 'update')
        ) {
            return;
        }

        throw new AuthorizationException('Bạn không có quyền cập nhật cấu hình mã tặng.');
    }
}
