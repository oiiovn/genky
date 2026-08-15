<?php

namespace App\Http\Controllers\Api\Marketing;

use App\Http\Controllers\Controller;
use App\Http\Requests\Marketing\IssueMarketingRewardRequest;
use App\Http\Requests\Marketing\RejectMarketingReviewRequest;
use App\Http\Requests\Marketing\StoreMarketingReviewRequest;
use App\Services\Marketing\MarketingRewardCodeService;
use App\Services\Marketing\MarketingReviewOverviewService;
use App\Services\Marketing\MarketingReviewService;
use App\Support\Authorization\EffectivePermission;
use App\Support\Marketing\MarketingPermissionMap;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MarketingReviewController extends Controller
{
    public function __construct(
        private readonly MarketingReviewService $reviews,
        private readonly MarketingRewardCodeService $rewardCodes,
        private readonly MarketingReviewOverviewService $overview,
    ) {
    }

    public function overview(Request $request): JsonResponse
    {
        EffectivePermission::for()->assertCan(
            MarketingPermissionMap::REVIEW,
            'view',
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
            'data' => $this->overview->overview($branchId, $from, $to),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        EffectivePermission::for()->assertCan(
            MarketingPermissionMap::REVIEW,
            'view',
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
            'data' => $this->overview->list($branchId, $from, $to),
        ]);
    }

    public function formMeta(): JsonResponse
    {
        EffectivePermission::for()->assertCan(
            MarketingPermissionMap::REVIEW,
            'create',
        );

        return response()->json([
            'data' => $this->reviews->formMeta(),
        ]);
    }

    public function store(StoreMarketingReviewRequest $request): JsonResponse
    {
        EffectivePermission::for()->assertCan(
            MarketingPermissionMap::REVIEW,
            'create',
        );

        $result = $this->reviews->createMany(
            $request->validated(),
            auth()->id(),
        );

        $saved = array_merge($result['created'], $result['updated']);
        $payload = array_map(
            fn ($review) => $this->reviews->payload($review),
            $saved,
        );

        $createdCount = count($result['created']);
        $updatedCount = count($result['updated']);
        $failedCount = count($result['failed']);

        $parts = [];
        if ($createdCount > 0) {
            $parts[] = $createdCount === 1
                ? 'thêm 1 đánh giá'
                : "thêm {$createdCount} đánh giá";
        }
        if ($updatedCount > 0) {
            $parts[] = $updatedCount === 1
                ? 'cập nhật 1 đánh giá'
                : "cập nhật {$updatedCount} đánh giá";
        }
        $message = $parts === []
            ? 'Không lưu được đánh giá.'
            : 'Đã '.implode(', ', $parts).'.';
        if ($failedCount > 0) {
            $message .= " Bỏ qua {$failedCount} mã lỗi.";
        }

        return response()->json([
            'data' => $payload,
            'meta' => [
                'created_count' => $createdCount,
                'updated_count' => $updatedCount,
                'failed_count' => $failedCount,
                'failed' => $result['failed'],
            ],
            'message' => $message,
        ], $createdCount > 0 ? 201 : 200);
    }

    public function verify(int $id): JsonResponse
    {
        EffectivePermission::for()->assertCan(
            MarketingPermissionMap::REVIEW,
            'update',
            'Bạn không có quyền xác minh đánh giá.',
        );

        $result = $this->reviews->verify($id, (int) auth()->id());

        $data = $this->reviews->payload($result['review']);
        if ($result['reward_code']) {
            $data['reward_code'] = $this->rewardCodes->payload($result['reward_code']);
        }

        return response()->json([
            'data' => $data,
            'message' => 'Đã xác minh đánh giá.',
        ]);
    }

    public function reject(RejectMarketingReviewRequest $request, int $id): JsonResponse
    {
        EffectivePermission::for()->assertCan(
            MarketingPermissionMap::REVIEW,
            'update',
            'Bạn không có quyền từ chối đánh giá.',
        );

        $review = $this->reviews->reject(
            $id,
            (string) $request->validated('reason'),
            (int) auth()->id(),
        );

        return response()->json([
            'data' => $this->reviews->payload($review),
            'message' => 'Đã từ chối đánh giá.',
        ]);
    }

    public function issueReward(IssueMarketingRewardRequest $request, int $id): JsonResponse
    {
        EffectivePermission::for()->assertCan(
            MarketingPermissionMap::REWARD,
            'create',
            'Bạn không có quyền cấp mã quà.',
        );

        $validated = $request->validated();
        $result = $this->reviews->issueReward(
            $id,
            isset($validated['reward_id']) ? (int) $validated['reward_id'] : null,
        );

        $data = $this->reviews->payload($result['review']);
        $data['reward_code'] = $this->rewardCodes->payload($result['reward_code']);

        return response()->json([
            'data' => $data,
            'message' => 'Đã cấp mã quà.',
        ], 201);
    }
}
