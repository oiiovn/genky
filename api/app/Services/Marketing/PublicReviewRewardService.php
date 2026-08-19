<?php

namespace App\Services\Marketing;

use App\Models\MarketingQrCode;
use App\Models\MarketingReview;
use App\Models\MarketingReviewCampaign;
use App\Models\MarketingRewardClaimSession;
use App\Models\MarketingRewardCode;
use App\Models\Organization;
use App\Support\Marketing\OrderCode;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PublicReviewRewardService
{
    public function __construct(
        private readonly MarketingReviewCampaignService $campaigns,
        private readonly MarketingRewardCodeService $rewardCodes,
        private readonly MarketingRewardCodeSettingService $codeSettings,
        private readonly MarketingRewardService $rewards,
    ) {}

    /**
     * Không trả mã quà ngay — chỉ tạo claim session + claim_token.
     *
     * @return array{success: true, claim_token: string, expires_in: int}
     */
    public function verifyOrder(
        string $campaignToken,
        string $orderCode,
        ?string $ipAddress = null,
    ): array {
        $qr = MarketingQrCode::withoutGlobalScopes()
            ->where('token', $campaignToken)
            ->where('enabled', true)
            ->first();

        if (! $qr) {
            throw ValidationException::withMessages([
                'campaign_token' => 'Mã chiến dịch / QR không hợp lệ.',
            ]);
        }

        $organization = Organization::query()->find($qr->organization_id);
        if (! $organization) {
            throw ValidationException::withMessages([
                'campaign_token' => 'Mã chiến dịch / QR không hợp lệ.',
            ]);
        }

        TenantContext::set($organization);

        try {
            $rewardCode = $this->resolveEligibleRewardCode(
                (int) $qr->campaign_id,
                $orderCode,
                $qr->branch_id ? (int) $qr->branch_id : null,
            );

            $session = MarketingRewardClaimSession::query()->create([
                'organization_id' => $organization->id,
                'reward_code_id' => $rewardCode->id,
                'review_id' => $rewardCode->review_id,
                'token' => Str::random(48),
                'expires_at' => now()->addMinutes(MarketingRewardClaimSession::TTL_MINUTES),
                'ip_address' => $ipAddress,
            ]);

            return [
                'success' => true,
                'claim_token' => $session->token,
                'expires_in' => MarketingRewardClaimSession::TTL_MINUTES * 60,
            ];
        } finally {
            TenantContext::clear();
        }
    }

    /**
     * Khách nhập mã đơn trên trang tặng → tìm review đã tải / thưởng trước nếu được cài.
     *
     * @return array{
     *   success: true,
     *   already_issued: bool,
     *   provisional: bool,
     *   reward: array{name: string, code: string, expires_at: ?string, image_url: ?string}
     * }
     */
    public function spin(int $orgId, string $orderCode): array
    {
        $organization = Organization::query()->find($orgId);
        if (! $organization) {
            throw ValidationException::withMessages([
                'org_id' => 'Cửa hàng không hợp lệ.',
            ]);
        }

        $normalized = OrderCode::normalize($orderCode);
        if (! OrderCode::isValid($normalized)) {
            throw ValidationException::withMessages([
                'order_code' => 'Mã đơn không đúng định dạng. Ví dụ: #08086-443874188 hoặc GF-888',
            ]);
        }

        TenantContext::set($organization);

        try {
            return DB::transaction(function () use ($normalized) {
                $campaign = $this->campaigns->ensureDefaultActiveCampaign();
                $this->rewards->seedDefaultsIfEmpty();
                $settings = $this->codeSettings->ensureDefaults((int) $campaign->organization_id);

                $existing = $this->rewardCodes->findActiveByOrder($campaign, $normalized);
                if ($existing) {
                    $this->assertRewardCodeClaimable($existing);
                    $existing = $this->rewardCodes->ensureRewardAttached($existing);

                    return $this->spinPayload($existing, alreadyIssued: true);
                }

                $review = MarketingReview::query()
                    ->where('campaign_id', $campaign->id)
                    ->whereIn('order_code', OrderCode::candidates($normalized))
                    ->orderByDesc('id')
                    ->lockForUpdate()
                    ->first();

                if ($review) {
                    if ($review->status === MarketingReview::STATUS_REJECTED) {
                        throw ValidationException::withMessages([
                            'order_code' => 'Đánh giá của đơn này đã bị từ chối.',
                        ]);
                    }

                    $code = $this->rewardCodes->issueForOrder(
                        $campaign,
                        $normalized,
                        $review,
                        false,
                    );

                    return $this->spinPayload($code, alreadyIssued: false);
                }

                if (! $settings->reward_before_review) {
                    throw ValidationException::withMessages([
                        'order_code' => 'Chưa tìm thấy đánh giá cho mã đơn này.',
                    ]);
                }

                $code = $this->rewardCodes->issueForOrder(
                    $campaign,
                    $normalized,
                    null,
                    true,
                );

                return $this->spinPayload($code, alreadyIssued: false);
            });
        } finally {
            TenantContext::clear();
        }
    }

    /**
     * @return array{kept: int, cancelled: int}
     */
    public function reconcileProvisional(): array
    {
        $kept = 0;
        $cancelled = 0;

        $ids = MarketingRewardCode::withoutGlobalScopes()
            ->where('provisional', true)
            ->where('status', MarketingRewardCode::STATUS_ISSUED)
            ->whereNotNull('reconcile_at')
            ->where('reconcile_at', '<=', now())
            ->pluck('id');

        foreach ($ids as $id) {
            $result = $this->reconcileOne((int) $id);
            if ($result === 'kept') {
                $kept++;
            } elseif ($result === 'cancelled') {
                $cancelled++;
            }
        }

        return ['kept' => $kept, 'cancelled' => $cancelled];
    }

    protected function reconcileOne(int $id): string
    {
        return DB::transaction(function () use ($id) {
            /** @var MarketingRewardCode|null $code */
            $code = MarketingRewardCode::withoutGlobalScopes()
                ->whereKey($id)
                ->lockForUpdate()
                ->first();

            if (! $code
                || ! $code->provisional
                || $code->status !== MarketingRewardCode::STATUS_ISSUED
            ) {
                return 'skip';
            }

            $organization = Organization::query()->find($code->organization_id);
            if (! $organization) {
                return 'skip';
            }

            TenantContext::set($organization);

            try {
                if ($code->redeemed_at) {
                    $code->provisional = false;
                    $code->reconcile_at = null;
                    $code->save();

                    return 'kept';
                }

                $review = MarketingReview::query()
                    ->where('campaign_id', $code->campaign_id)
                    ->whereIn('order_code', OrderCode::candidates((string) $code->order_code))
                    ->whereIn('status', [
                        MarketingReview::STATUS_PENDING,
                        MarketingReview::STATUS_VERIFIED,
                    ])
                    ->orderByDesc('id')
                    ->lockForUpdate()
                    ->first();

                if ($review) {
                    $code->review_id = $code->review_id ?: $review->id;
                    $code->provisional = false;
                    $code->reconcile_at = null;
                    $code->save();

                    return 'kept';
                }

                $code->status = MarketingRewardCode::STATUS_CANCELLED;
                $code->provisional = false;
                $code->reconcile_at = null;
                $code->save();

                return 'cancelled';
            } finally {
                TenantContext::clear();
            }
        });
    }

    /**
     * @return array{
     *   success: true,
     *   already_issued: bool,
     *   provisional: bool,
     *   reward: array{name: string, code: string, expires_at: ?string, image_url: ?string}
     * }
     */
    protected function spinPayload(MarketingRewardCode $code, bool $alreadyIssued): array
    {
        $code->loadMissing('reward');

        return [
            'success' => true,
            'already_issued' => $alreadyIssued,
            'provisional' => (bool) $code->provisional,
            'reward' => [
                'name' => $code->reward?->name ?? 'Quà tặng',
                'code' => $code->code,
                'expires_at' => $code->expires_at?->format('Y-m-d'),
                'image_url' => $code->reward?->imageUrl(),
                'display_value' => $code->reward?->customerDisplayValue() ?? 0,
            ],
        ];
    }

    /**
     * One-time claim — mới trả reward code.
     *
     * @return array{success: true, reward: array{name: string, code: string, expires_at: ?string}}
     */
    public function claim(string $claimToken): array
    {
        return DB::transaction(function () use ($claimToken) {
            /** @var MarketingRewardClaimSession|null $session */
            $session = MarketingRewardClaimSession::withoutGlobalScopes()
                ->where('token', $claimToken)
                ->lockForUpdate()
                ->first();

            if (! $session) {
                throw ValidationException::withMessages([
                    'claim_token' => 'Token không hợp lệ.',
                ]);
            }

            $organization = Organization::query()->find($session->organization_id);
            if (! $organization) {
                throw ValidationException::withMessages([
                    'claim_token' => 'Token không hợp lệ.',
                ]);
            }

            TenantContext::set($organization);

            try {
                if ($session->isConsumed()) {
                    throw ValidationException::withMessages([
                        'claim_token' => 'Token đã được sử dụng.',
                    ]);
                }

                if ($session->isExpired()) {
                    throw ValidationException::withMessages([
                        'claim_token' => 'Token đã hết hạn.',
                    ]);
                }

                /** @var MarketingRewardCode $rewardCode */
                $rewardCode = MarketingRewardCode::query()
                    ->with('reward')
                    ->whereKey($session->reward_code_id)
                    ->lockForUpdate()
                    ->firstOrFail();

                $this->assertRewardCodeClaimable($rewardCode);
                $rewardCode = $this->rewardCodes->ensureRewardAttached($rewardCode);

                $session->consumed_at = now();
                $session->save();

                return [
                    'success' => true,
                    'reward' => [
                        'name' => $rewardCode->reward?->name ?? 'Quà tặng',
                        'code' => $rewardCode->code,
                        'expires_at' => $rewardCode->expires_at
                            ? $rewardCode->expires_at->format('Y-m-d')
                            : null,
                        'display_value' => $rewardCode->reward?->customerDisplayValue() ?? 0,
                    ],
                ];
            } finally {
                TenantContext::clear();
            }
        });
    }

    protected function resolveEligibleRewardCode(
        int $campaignId,
        string $orderCode,
        ?int $branchId = null,
    ): MarketingRewardCode {
        /** @var MarketingReviewCampaign|null $campaign */
        $campaign = MarketingReviewCampaign::query()->whereKey($campaignId)->first();

        if (! $campaign || $campaign->status !== MarketingReviewCampaign::STATUS_ACTIVE) {
            throw ValidationException::withMessages([
                'campaign_token' => 'Chiến dịch không còn hiệu lực.',
            ]);
        }

        /** @var MarketingReview|null $review */
        $review = MarketingReview::query()
            ->where('campaign_id', $campaign->id)
            ->whereIn('order_code', OrderCode::candidates($orderCode))
            ->when($branchId, fn ($q) => $q->where('branch_id', $branchId))
            ->first();

        if (! $review) {
            throw ValidationException::withMessages([
                'order_code' => $branchId
                    ? 'Không tìm thấy đánh giá cho mã đơn tại chi nhánh của QR này.'
                    : 'Không tìm thấy đánh giá cho mã đơn này.',
            ]);
        }

        if ((int) $review->rating < (int) $campaign->min_rating) {
            throw ValidationException::withMessages([
                'rating' => 'Đánh giá chưa đủ điều kiện nhận quà.',
            ]);
        }

        if ($review->status !== MarketingReview::STATUS_VERIFIED) {
            throw ValidationException::withMessages([
                'status' => $review->status === MarketingReview::STATUS_PENDING
                    ? 'Đánh giá đang chờ xác minh.'
                    : 'Đánh giá chưa được xác minh hoặc đã bị từ chối.',
            ]);
        }

        /** @var MarketingRewardCode|null $rewardCode */
        $rewardCode = MarketingRewardCode::query()
            ->where('review_id', $review->id)
            ->first();

        if (! $rewardCode) {
            throw ValidationException::withMessages([
                'reward' => 'Chưa có mã quà cho đơn này.',
            ]);
        }

        $this->assertRewardCodeClaimable($rewardCode);

        return $rewardCode;
    }

    protected function assertRewardCodeClaimable(MarketingRewardCode $rewardCode): void
    {
        if ($rewardCode->status === MarketingRewardCode::STATUS_REDEEMED
            || $rewardCode->redeemed_at !== null
        ) {
            throw ValidationException::withMessages([
                'reward' => 'Mã quà đã được đổi.',
            ]);
        }

        if ($rewardCode->status === MarketingRewardCode::STATUS_CANCELLED) {
            throw ValidationException::withMessages([
                'reward' => 'Mã quà đã bị hủy.',
            ]);
        }

        if ($rewardCode->status === MarketingRewardCode::STATUS_EXPIRED
            || ($rewardCode->expires_at && $rewardCode->expires_at->isPast())
        ) {
            if ($rewardCode->status !== MarketingRewardCode::STATUS_EXPIRED) {
                $rewardCode->status = MarketingRewardCode::STATUS_EXPIRED;
                $rewardCode->save();
            }

            throw ValidationException::withMessages([
                'reward' => 'Mã quà đã hết hạn.',
            ]);
        }

        if ($rewardCode->status !== MarketingRewardCode::STATUS_ISSUED) {
            throw ValidationException::withMessages([
                'reward' => 'Mã quà không còn hiệu lực.',
            ]);
        }
    }
}
