<?php

namespace App\Services\Marketing;

use App\Models\MarketingCampaignReward;
use App\Models\MarketingReward;
use App\Models\MarketingRewardCode;
use App\Models\MarketingRewardCodeSetting;
use App\Models\MarketingReview;
use App\Models\MarketingReviewCampaign;
use App\Support\Marketing\OrderCode;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Validation\ValidationException;

class MarketingRewardCodeService
{
    public function __construct(
        private readonly MarketingRewardCodeSettingService $codeSettings,
    ) {
    }

    public function issueForVerifiedReview(
        MarketingReview $review,
        MarketingReviewCampaign $campaign,
        ?int $rewardId = null,
    ): MarketingRewardCode {
        return $this->issueForOrder(
            $campaign,
            (string) $review->order_code,
            $review,
            false,
            $rewardId,
        );
    }

    public function issueForOrder(
        MarketingReviewCampaign $campaign,
        string $orderCode,
        ?MarketingReview $review = null,
        bool $provisional = false,
        ?int $rewardId = null,
    ): MarketingRewardCode {
        $existing = $this->findActiveByOrder($campaign, $orderCode);
        if ($existing) {
            throw ValidationException::withMessages([
                'order_code' => 'Mã đơn này đã nhận thưởng.',
            ]);
        }

        if ($review) {
            $already = MarketingRewardCode::query()
                ->where('review_id', $review->id)
                ->lockForUpdate()
                ->exists();

            if ($already) {
                throw ValidationException::withMessages([
                    'review_id' => 'Review này đã được cấp mã quà.',
                ]);
            }
        }

        $this->assertRewardCaps($campaign, $orderCode, $review);

        $reward = $rewardId
            ? $this->resolveReward($campaign, $rewardId)
            : $this->pickReward($campaign);
        $settings = $this->codeSettings->ensureDefaults((int) $campaign->organization_id);
        $code = $this->generateUniqueCode($settings, (int) $campaign->organization_id);
        $now = now();

        try {
            return MarketingRewardCode::query()->create([
                'organization_id' => $campaign->organization_id,
                'campaign_id' => $campaign->id,
                'review_id' => $review?->id,
                'order_code' => $orderCode,
                'reward_id' => $reward->id,
                'code' => $code,
                'status' => MarketingRewardCode::STATUS_ISSUED,
                'provisional' => $provisional,
                'reconcile_at' => $provisional ? $now->copy()->addHours(48) : null,
                'issued_at' => $now,
                'expires_at' => $this->resolveExpiresAt($settings, $now),
            ]);
        } catch (QueryException $e) {
            if ($this->isDuplicateReviewRewardViolation($e)) {
                throw ValidationException::withMessages([
                    'review_id' => 'Review này đã được cấp mã quà.',
                ]);
            }

            if ($this->isDuplicateCodeViolation($e)) {
                throw ValidationException::withMessages([
                    'code' => 'Mã quà bị trùng. Thử lại.',
                ]);
            }

            throw $e;
        }
    }

    public function findActiveByOrder(
        MarketingReviewCampaign $campaign,
        string $orderCode,
    ): ?MarketingRewardCode {
        $candidates = OrderCode::candidates($orderCode);

        return MarketingRewardCode::query()
            ->where('campaign_id', $campaign->id)
            ->whereIn('order_code', $candidates)
            ->whereIn('status', [
                MarketingRewardCode::STATUS_ISSUED,
                MarketingRewardCode::STATUS_REDEEMED,
            ])
            ->lockForUpdate()
            ->orderByDesc('id')
            ->first();
    }

    public function payload(MarketingRewardCode $code): array
    {
        $code->loadMissing('reward');

        return [
            'id' => $code->id,
            'campaign_id' => $code->campaign_id,
            'review_id' => $code->review_id,
            'order_code' => $code->order_code,
            'reward_id' => $code->reward_id,
            'reward_name' => $code->reward?->name,
            'code' => $code->code,
            'status' => $code->status,
            'provisional' => (bool) $code->provisional,
            'issued_at' => optional($code->issued_at)?->toIso8601String(),
            'expires_at' => optional($code->expires_at)?->toIso8601String(),
        ];
    }

    protected function assertRewardCaps(
        MarketingReviewCampaign $campaign,
        string $orderCode,
        ?MarketingReview $review,
    ): void {
        if ($campaign->max_reward_per_order !== null) {
            $count = MarketingRewardCode::query()
                ->where('campaign_id', $campaign->id)
                ->where(function ($q) use ($orderCode, $review) {
                    $q->whereIn('order_code', OrderCode::candidates($orderCode));
                    if ($review) {
                        $q->orWhereHas(
                            'review',
                            fn ($r) => $r->whereIn('order_code', OrderCode::candidates($orderCode)),
                        );
                    }
                })
                ->whereIn('status', [
                    MarketingRewardCode::STATUS_ISSUED,
                    MarketingRewardCode::STATUS_REDEEMED,
                ])
                ->lockForUpdate()
                ->count();

            if ($count >= (int) $campaign->max_reward_per_order) {
                throw ValidationException::withMessages([
                    'order_code' => 'Đơn hàng đã đạt giới hạn số mã quà.',
                ]);
            }
        }

        if ($review
            && $campaign->max_reward_per_customer !== null
            && filled($review->customer_phone)
        ) {
            $count = MarketingRewardCode::query()
                ->where('campaign_id', $campaign->id)
                ->whereHas(
                    'review',
                    fn ($q) => $q->where('customer_phone', $review->customer_phone)
                )
                ->whereIn('status', [
                    MarketingRewardCode::STATUS_ISSUED,
                    MarketingRewardCode::STATUS_REDEEMED,
                ])
                ->lockForUpdate()
                ->count();

            if ($count >= (int) $campaign->max_reward_per_customer) {
                throw ValidationException::withMessages([
                    'customer_phone' => 'Khách đã đạt giới hạn số mã quà.',
                ]);
            }
        }
    }

    protected function pickReward(MarketingReviewCampaign $campaign): MarketingReward
    {
        $links = MarketingCampaignReward::query()
            ->where('campaign_id', $campaign->id)
            ->where('enabled', true)
            ->lockForUpdate()
            ->get();

        if ($links->isEmpty()) {
            // Fallback: gắn mọi món đang bật của org vào chiến dịch rồi chọn.
            $enabled = MarketingReward::query()
                ->enabled()
                ->ordered()
                ->lockForUpdate()
                ->get();

            if ($enabled->isEmpty()) {
                throw ValidationException::withMessages([
                    'reward' => 'Chưa có món quà. Thêm món trong Cài đặt → Món tặng.',
                ]);
            }

            foreach ($enabled as $reward) {
                MarketingCampaignReward::query()->updateOrCreate(
                    [
                        'campaign_id' => $campaign->id,
                        'reward_id' => $reward->id,
                    ],
                    [
                        'quantity' => null,
                        'enabled' => true,
                    ],
                );
            }

            /** @var MarketingReward $picked */
            $picked = $enabled->random();

            return $picked;
        }

        /** @var MarketingCampaignReward $picked */
        $picked = $links->random();

        return $this->resolveReward($campaign, (int) $picked->reward_id);
    }

    protected function resolveReward(
        MarketingReviewCampaign $campaign,
        int $rewardId,
    ): MarketingReward {
        $linked = MarketingCampaignReward::query()
            ->where('campaign_id', $campaign->id)
            ->where('reward_id', $rewardId)
            ->where('enabled', true)
            ->exists();

        if (! $linked) {
            throw ValidationException::withMessages([
                'reward_id' => 'Món quà không thuộc chiến dịch (hoặc đang tắt).',
            ]);
        }

        $reward = MarketingReward::query()
            ->whereKey($rewardId)
            ->where('enabled', true)
            ->first();

        if (! $reward) {
            throw ValidationException::withMessages([
                'reward_id' => 'Món quà đã bị tắt.',
            ]);
        }

        return $reward;
    }

    protected function settingsFor(int $organizationId): MarketingRewardCodeSetting
    {
        return $this->codeSettings->ensureDefaults($organizationId);
    }

    protected function generateUniqueCode(
        MarketingRewardCodeSetting $settings,
        int $organizationId,
    ): string {
        $alphabet = $this->alphabet($settings);
        $length = max(1, (int) $settings->length);
        $prefix = strtoupper(trim((string) $settings->prefix));
        $pattern = strtoupper(trim((string) $settings->pattern));

        for ($attempt = 0; $attempt < 30; $attempt++) {
            $code = $this->formatCode($pattern, $prefix, $length, $alphabet);

            $exists = MarketingRewardCode::query()
                ->where('organization_id', $organizationId)
                ->where('code', $code)
                ->exists();

            if (! $exists) {
                return $code;
            }
        }

        throw ValidationException::withMessages([
            'code' => 'Không tạo được mã quà duy nhất. Thử lại.',
        ]);
    }

    protected function formatCode(
        string $pattern,
        string $prefix,
        int $length,
        string $alphabet,
    ): string {
        if ($pattern === 'XXXX-XXXX') {
            return $this->randomBody($alphabet, 4).'-'.$this->randomBody($alphabet, 4);
        }

        if (preg_match('/^([A-Z0-9]+)-(X+)$/', $pattern, $m)) {
            return $m[1].'-'.$this->randomBody($alphabet, strlen($m[2]));
        }

        $body = $this->randomBody($alphabet, $length);

        return $prefix !== '' ? $prefix.'-'.$body : $body;
    }

    protected function randomBody(string $alphabet, int $length): string
    {
        $body = '';
        for ($i = 0; $i < max(1, $length); $i++) {
            $body .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        return $body;
    }

    protected function alphabet(MarketingRewardCodeSetting $settings): string
    {
        $letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        $numbers = '0123456789';

        if ($settings->exclude_o) {
            $letters = str_replace('O', '', $letters);
        }
        if ($settings->exclude_i) {
            $letters = str_replace('I', '', $letters);
        }
        if ($settings->exclude_zero) {
            $numbers = str_replace('0', '', $numbers);
        }
        if ($settings->exclude_one) {
            $numbers = str_replace('1', '', $numbers);
        }

        $pool = '';
        if ($settings->use_letters) {
            $pool .= $letters;
        }
        if ($settings->use_numbers) {
            $pool .= $numbers;
        }

        if ($pool === '') {
            throw ValidationException::withMessages([
                'code_config' => 'Cấu hình mã quà không có ký tự hợp lệ.',
            ]);
        }

        return $pool;
    }

    protected function resolveExpiresAt(
        MarketingRewardCodeSetting $settings,
        Carbon $issuedAt,
    ): ?Carbon {
        $type = strtoupper((string) $settings->expiry_type);

        return match ($type) {
            'NEVER' => null,
            'DATE', 'FIXED_DATE' => $settings->expiry_date
                ? Carbon::parse($settings->expiry_date)->endOfDay()
                : null,
            default => (int) $settings->expiry_days > 0
                ? $issuedAt->copy()->addDays((int) $settings->expiry_days)
                : null,
        };
    }

    protected function isDuplicateReviewRewardViolation(QueryException $e): bool
    {
        $message = $e->getMessage();

        return str_contains($message, 'marketing_reward_codes_review_id_unique')
            || (
                str_contains($message, 'Duplicate entry')
                && str_contains($message, 'review_id')
            );
    }

    protected function isDuplicateCodeViolation(QueryException $e): bool
    {
        $message = $e->getMessage();

        return str_contains($message, 'marketing_reward_codes_organization_id_code_unique')
            || (
                str_contains($message, 'Duplicate entry')
                && str_contains($message, 'code')
            );
    }
}
