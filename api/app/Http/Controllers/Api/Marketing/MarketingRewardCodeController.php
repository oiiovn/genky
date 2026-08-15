<?php

namespace App\Http\Controllers\Api\Marketing;

use App\Http\Controllers\Controller;
use App\Http\Requests\Marketing\CheckRewardCodeRequest;
use App\Http\Requests\Marketing\RedeemRewardCodeRequest;
use App\Services\Marketing\MarketingRewardCodeService;
use App\Services\Marketing\MarketingRewardRedemptionService;
use App\Support\Authorization\EffectivePermission;
use App\Support\Marketing\MarketingPermissionMap;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MarketingRewardCodeController extends Controller
{
    public function __construct(
        private readonly MarketingRewardRedemptionService $redemptions,
        private readonly MarketingRewardCodeService $codes,
    ) {
    }

    public function history(Request $request): JsonResponse
    {
        EffectivePermission::for()->assertCan(
            MarketingPermissionMap::REVIEW,
            'view',
            'Bạn không có quyền xem lịch sử đổi quà.',
        );

        $branchId = $request->filled('branch_id')
            ? (int) $request->input('branch_id')
            : null;
        $from = $request->filled('from')
            ? Carbon::parse((string) $request->input('from'))->startOfDay()
            : null;
        $to = $request->filled('to')
            ? Carbon::parse((string) $request->input('to'))->endOfDay()
            : null;

        return response()->json([
            'data' => $this->redemptions->history($branchId, $from, $to),
        ]);
    }

    public function check(CheckRewardCodeRequest $request): JsonResponse
    {
        EffectivePermission::for()->assertCan(
            MarketingPermissionMap::REWARD,
            'view',
            'Bạn không có quyền kiểm tra mã quà.',
        );

        return response()->json([
            'data' => $this->redemptions->check((string) $request->validated('code')),
        ]);
    }

    public function redeem(RedeemRewardCodeRequest $request, int $id): JsonResponse
    {
        EffectivePermission::for()->assertCan(
            MarketingPermissionMap::REDEMPTION,
            'create',
            'Bạn không có quyền đổi quà.',
        );

        $result = $this->redemptions->redeem(
            $id,
            [
                ...$request->validated(),
                'ip_address' => $request->ip(),
            ],
            $request->user(),
        );

        return response()->json([
            'data' => [
                'reward_code' => $this->codes->payload($result['reward_code']),
                'redemption_id' => $result['redemption']->id,
                'redeemed_at' => optional($result['redemption']->redeemed_at)?->toIso8601String(),
            ],
            'message' => 'Đã đổi quà thành công.',
        ]);
    }
}
