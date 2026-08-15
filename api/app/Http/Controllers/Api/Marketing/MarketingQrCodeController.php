<?php

namespace App\Http\Controllers\Api\Marketing;

use App\Http\Controllers\Controller;
use App\Services\Marketing\MarketingQrCodeService;
use App\Support\Authorization\EffectivePermission;
use App\Support\Marketing\MarketingPermissionMap;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\JsonResponse;

class MarketingQrCodeController extends Controller
{
    public function __construct(
        private readonly MarketingQrCodeService $qrs,
    ) {
    }

    public function index(): JsonResponse
    {
        $this->assertCanView();

        return response()->json([
            'data' => $this->qrs->listBranchQrs(),
        ]);
    }

    public function ensureBranches(): JsonResponse
    {
        $this->assertCanManage();

        $rows = $this->qrs->ensureBranchQrsForActiveCampaign();

        return response()->json([
            'data' => $rows,
            'message' => 'Đã tạo / đồng bộ QR theo chi nhánh.',
        ]);
    }

    protected function assertCanView(): void
    {
        $perm = EffectivePermission::for();
        if (
            $perm->can(MarketingPermissionMap::SETTINGS, 'view')
            || $perm->can(MarketingPermissionMap::REVIEW, 'view')
            || $perm->can(MarketingPermissionMap::CAMPAIGN, 'view')
        ) {
            return;
        }

        throw new AuthorizationException('Bạn không có quyền xem QR chiến dịch.');
    }

    protected function assertCanManage(): void
    {
        $perm = EffectivePermission::for();
        if (
            $perm->can(MarketingPermissionMap::SETTINGS, 'update')
            || $perm->can(MarketingPermissionMap::REVIEW, 'update')
            || $perm->can(MarketingPermissionMap::CAMPAIGN, 'update')
        ) {
            return;
        }

        throw new AuthorizationException('Bạn không có quyền tạo QR chiến dịch.');
    }
}
