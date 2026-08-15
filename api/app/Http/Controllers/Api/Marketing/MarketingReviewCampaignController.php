<?php

namespace App\Http\Controllers\Api\Marketing;

use App\Http\Controllers\Controller;
use App\Models\MarketingReviewCampaign;
use App\Services\Marketing\MarketingReviewCampaignService;
use App\Support\Authorization\EffectivePermission;
use App\Support\Marketing\MarketingPermissionMap;
use Illuminate\Http\JsonResponse;

class MarketingReviewCampaignController extends Controller
{
    public function __construct(
        private readonly MarketingReviewCampaignService $campaigns,
    ) {
    }

    public function activate(int $id): JsonResponse
    {
        EffectivePermission::for()->assertCan(
            MarketingPermissionMap::CAMPAIGN,
            'update',
            'Bạn không có quyền kích hoạt chiến dịch.',
        );

        $campaign = MarketingReviewCampaign::query()->findOrFail($id);
        $activated = $this->campaigns->activate($campaign);

        return response()->json([
            'data' => $this->campaigns->payload($activated),
            'message' => 'Đã kích hoạt chiến dịch.',
        ]);
    }
}
