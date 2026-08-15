<?php

namespace App\Services\Marketing;

use App\Models\MarketingQrCode;
use App\Models\MarketingReview;
use App\Models\MarketingReviewCampaign;
use App\Models\MarketingRewardClaimSession;
use App\Models\MarketingRewardCode;
use App\Models\Organization;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PublicReviewRewardService
{
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
            ->where('order_code', $orderCode)
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
