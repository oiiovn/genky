<?php

namespace App\Http\Controllers\Api\Marketing;

use App\Http\Controllers\Controller;
use App\Http\Requests\Marketing\UpdateMarketingLandingStyleRequest;
use App\Http\Requests\Marketing\UploadMarketingLandingAudioRequest;
use App\Services\Marketing\MarketingLandingAudioService;
use App\Services\Marketing\MarketingLandingStyleService;
use App\Support\Authorization\EffectivePermission;
use App\Support\Marketing\MarketingPermissionMap;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;

class MarketingLandingController extends Controller
{
    public function __construct(
        private readonly MarketingLandingAudioService $audio,
        private readonly MarketingLandingStyleService $style,
    ) {
    }

    public function show(): JsonResponse
    {
        $this->assertCanView();

        return response()->json([
            'data' => $this->style->show(),
        ]);
    }

    public function update(UpdateMarketingLandingStyleRequest $request): JsonResponse
    {
        $this->assertCanManage();

        return response()->json([
            'data' => $this->style->update([
                'style' => $request->input('style', []),
                'landing' => $request->input('landing', []),
            ]),
            'message' => 'Đã lưu trang tặng.',
        ]);
    }

    public function showAudio(): JsonResponse
    {
        $this->assertCanView();

        return response()->json([
            'data' => $this->audio->show(),
        ]);
    }

    public function uploadAudio(UploadMarketingLandingAudioRequest $request): JsonResponse
    {
        $this->assertCanManage();

        return response()->json([
            'data' => $this->audio->upload($request->file('audio')),
            'message' => 'Đã tải bản ghi hướng dẫn.',
        ]);
    }

    public function clearAudio(): JsonResponse
    {
        $this->assertCanManage();

        return response()->json([
            'data' => $this->audio->clear(),
            'message' => 'Đã xoá bản ghi hướng dẫn.',
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

        throw new AuthorizationException('Bạn không có quyền xem trang tặng.');
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

        throw new AuthorizationException('Bạn không có quyền cập nhật trang tặng.');
    }
}
