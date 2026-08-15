<?php

namespace App\Services\Marketing;

use App\Models\MarketingChannel;
use App\Models\MarketingQrCode;
use App\Models\MarketingReview;
use App\Models\MarketingReviewCampaign;
use App\Models\MarketingRewardCode;
use App\Models\MarketingRewardRedemption;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

class MarketingReviewOverviewService
{
    /**
     * @return array<string, mixed>
     */
    public function overview(?int $branchId, ?Carbon $from, ?Carbon $to): array
    {
        $from = ($from ?? now()->subDays(12))->startOfDay();
        $to = ($to ?? now())->endOfDay();

        return $this->buildDashboard($branchId, $from, $to);
    }

    /**
     * Danh sách tab Đánh giá 5★ (mặc định 90 ngày gần nhất).
     *
     * @return array{listStats: array<string, mixed>, listRows: list<array<string, mixed>>, topCustomers: list<array<string, mixed>>}
     */
    public function list(?int $branchId, ?Carbon $from, ?Carbon $to): array
    {
        $from = ($from ?? now()->subDays(90))->startOfDay();
        $to = ($to ?? now())->endOfDay();
        $full = $this->buildDashboard($branchId, $from, $to);

        return [
            'listStats' => $full['listStats'],
            'listRows' => $full['listRows'],
            'topCustomers' => $full['topCustomers'],
            'from' => $full['from'],
            'to' => $full['to'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    protected function buildDashboard(?int $branchId, Carbon $from, Carbon $to): array
    {
        $prevFrom = $from->copy()->subDays($from->diffInDays($to) + 1);
        $prevTo = $from->copy()->subSecond();

        $reviewsQ = $this->reviewsQuery($branchId, $from, $to);
        $prevReviewsQ = $this->reviewsQuery($branchId, $prevFrom, $prevTo);

        $totalReviews = (clone $reviewsQ)->count();
        $prevTotalReviews = (clone $prevReviewsQ)->count();

        $pending = (clone $reviewsQ)->where('status', MarketingReview::STATUS_PENDING)->count();
        $verified = (clone $reviewsQ)->where('status', MarketingReview::STATUS_VERIFIED)->count();
        $rejected = (clone $reviewsQ)->where('status', MarketingReview::STATUS_REJECTED)->count();

        $gifted = (clone $reviewsQ)
            ->where('status', MarketingReview::STATUS_VERIFIED)
            ->whereHas(
                'rewardCodes',
                fn (Builder $q) => $q->where('status', MarketingRewardCode::STATUS_REDEEMED)
            )
            ->count();
        $ungifted = max(0, $verified - $gifted);

        $codesQ = $this->codesQuery($branchId, $from, $to);
        $codesIssued = (clone $codesQ)->count();
        $prevCodes = $this->codesQuery($branchId, $prevFrom, $prevTo)->count();

        $redeemedQ = $this->redemptionsQuery($branchId, $from, $to);
        $redeemed = (clone $redeemedQ)->count();
        $prevRedeemed = $this->redemptionsQuery($branchId, $prevFrom, $prevTo)->count();

        $redeemRatePct = $codesIssued > 0 ? round(($redeemed / $codesIssued) * 100, 1) : 0.0;
        $prevRedeemRate = $prevCodes > 0
            ? ($prevRedeemed / $prevCodes) * 100
            : 0.0;

        $campaign = MarketingReviewCampaign::query()
            ->withCount([
                'campaignBranches',
                'campaignChannels',
                'reviews',
                'rewardCodes',
            ])
            ->where('status', MarketingReviewCampaign::STATUS_ACTIVE)
            ->orderByDesc('start_at')
            ->first();

        $publicPath = $this->publicReviewPath($campaign?->id);

        return [
            'kpis' => [
                [
                    'id' => 'reviews',
                    'label' => 'Đánh giá 5★',
                    'value' => $totalReviews,
                    'deltaPct' => $this->deltaPct($totalReviews, $prevTotalReviews),
                ],
                [
                    'id' => 'verified',
                    'label' => 'Đã xác minh',
                    'value' => $verified,
                    'deltaPct' => $this->deltaPct(
                        $verified,
                        (clone $prevReviewsQ)->where('status', MarketingReview::STATUS_VERIFIED)->count()
                    ),
                    'sub' => $totalReviews > 0
                        ? round(($verified / $totalReviews) * 100, 1).'%'
                        : '0%',
                ],
                [
                    'id' => 'codes',
                    'label' => 'Mã đã cấp',
                    'value' => $codesIssued,
                    'deltaPct' => $this->deltaPct($codesIssued, $prevCodes),
                ],
                [
                    'id' => 'redeemed',
                    'label' => 'Đã đổi quà',
                    'value' => $redeemed,
                    'deltaPct' => $this->deltaPct($redeemed, $prevRedeemed),
                ],
            ],
            'funnel' => [
                [
                    'id' => 'submitted',
                    'label' => 'Đánh giá',
                    'value' => $totalReviews,
                ],
                [
                    'id' => 'pending',
                    'label' => 'Chờ xác minh',
                    'value' => $pending,
                    'convertPct' => $totalReviews > 0
                        ? round(($pending / $totalReviews) * 100, 1)
                        : 0,
                ],
                [
                    'id' => 'verified',
                    'label' => 'Đã xác minh',
                    'value' => $verified,
                    'convertPct' => $totalReviews > 0
                        ? round(($verified / $totalReviews) * 100, 1)
                        : 0,
                ],
                [
                    'id' => 'codes',
                    'label' => 'Đã cấp mã',
                    'value' => $codesIssued,
                    'convertPct' => $verified > 0
                        ? round(($codesIssued / $verified) * 100, 1)
                        : 0,
                ],
                [
                    'id' => 'redeemed',
                    'label' => 'Đã đổi',
                    'value' => $redeemed,
                    'convertPct' => $codesIssued > 0
                        ? round(($redeemed / $codesIssued) * 100, 1)
                        : 0,
                ],
            ],
            'daily' => $this->dailySeries($branchId, $from, $to),
            'channels' => $this->channelSlices($branchId, $from, $to),
            'redeemRatePct' => $redeemRatePct,
            'redeemNumer' => $redeemed,
            'redeemDenom' => $codesIssued,
            'redeemDeltaPct' => round($redeemRatePct - $prevRedeemRate, 1),
            'topBranches' => $this->topBranches($from, $to),
            'latest' => $this->latestReviews($branchId, 8),
            'campaign' => $campaign ? $this->campaignPayload($campaign, $redeemed) : null,
            'publicReviewPath' => $publicPath,
            'pendingCount' => $pending,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'listStats' => [
                'total' => $totalReviews,
                'pending' => $pending,
                'verified' => $verified,
                'gifted' => $gifted,
                'ungifted' => $ungifted,
                'rejected' => $rejected,
                'totalDeltaPct' => $this->deltaPct($totalReviews, $prevTotalReviews),
                'pendingPct' => $totalReviews > 0 ? round(($pending / $totalReviews) * 100, 1) : 0,
                'verifiedPct' => $totalReviews > 0 ? round(($verified / $totalReviews) * 100, 1) : 0,
                'giftedPct' => $totalReviews > 0 ? round(($gifted / $totalReviews) * 100, 1) : 0,
            ],
            'listRows' => $this->listRows($branchId, $from, $to),
            'topCustomers' => $this->topCustomers($branchId, $from, $to),
            'redeemStats' => [
                'total' => $redeemed,
                'success' => $redeemed,
                'successPct' => 100,
                'processing' => 0,
                'processingPct' => 0,
                'failed' => 0,
                'failedPct' => 0,
                'totalValue' => 0,
            ],
            'redeemRows' => [],
        ];
    }

    protected function reviewsQuery(?int $branchId, Carbon $from, Carbon $to): Builder
    {
        $q = MarketingReview::query()
            ->whereBetween('reviewed_at', [$from, $to]);

        if ($branchId) {
            $q->where('branch_id', $branchId);
        }

        return $q;
    }

    protected function codesQuery(?int $branchId, Carbon $from, Carbon $to): Builder
    {
        $q = MarketingRewardCode::query()
            ->whereBetween('issued_at', [$from, $to]);

        if ($branchId) {
            $q->whereHas('review', fn (Builder $r) => $r->where('branch_id', $branchId));
        }

        return $q;
    }

    protected function redemptionsQuery(?int $branchId, Carbon $from, Carbon $to): Builder
    {
        $q = MarketingRewardRedemption::query()
            ->whereBetween('redeemed_at', [$from, $to]);

        if ($branchId) {
            $q->where('branch_id', $branchId);
        }

        return $q;
    }

    /**
     * @return list<array{date: string, label: string, count: int}>
     */
    protected function dailySeries(?int $branchId, Carbon $from, Carbon $to): array
    {
        $rows = MarketingReview::query()
            ->selectRaw('DATE(reviewed_at) as d, COUNT(*) as c')
            ->whereBetween('reviewed_at', [$from, $to])
            ->when($branchId, fn (Builder $q) => $q->where('branch_id', $branchId))
            ->groupBy('d')
            ->orderBy('d')
            ->pluck('c', 'd');

        $out = [];
        $cursor = $from->copy()->startOfDay();
        while ($cursor->lte($to)) {
            $key = $cursor->toDateString();
            $out[] = [
                'date' => $key,
                'label' => $cursor->format('d/m'),
                'count' => (int) ($rows[$key] ?? 0),
            ];
            $cursor->addDay();
        }

        return $out;
    }

    /**
     * @return list<array{id: string, label: string, value: int, color: string}>
     */
    protected function channelSlices(?int $branchId, Carbon $from, Carbon $to): array
    {
        $counts = MarketingReview::query()
            ->selectRaw('channel_id, COUNT(*) as c')
            ->whereBetween('reviewed_at', [$from, $to])
            ->when($branchId, fn (Builder $q) => $q->where('branch_id', $branchId))
            ->groupBy('channel_id')
            ->pluck('c', 'channel_id');

        if ($counts->isEmpty()) {
            return [];
        }

        $channels = MarketingChannel::query()
            ->whereIn('id', $counts->keys())
            ->get()
            ->keyBy('id');

        $out = [];
        foreach ($counts as $channelId => $count) {
            /** @var MarketingChannel|null $ch */
            $ch = $channels->get($channelId);
            $out[] = [
                'id' => strtolower((string) ($ch?->code ?? $channelId)),
                'label' => $ch?->name ?? 'Kênh #'.$channelId,
                'value' => (int) $count,
                'color' => $ch?->color ?: '#64748B',
            ];
        }

        usort($out, fn ($a, $b) => $b['value'] <=> $a['value']);

        return $out;
    }

    /**
     * @return list<array{name: string, reviews: int, redeemed: int, ratePct: float}>
     */
    protected function topBranches(Carbon $from, Carbon $to): array
    {
        $reviewRows = MarketingReview::query()
            ->selectRaw('branch_id, COUNT(*) as c')
            ->whereBetween('reviewed_at', [$from, $to])
            ->groupBy('branch_id')
            ->pluck('c', 'branch_id');

        $redeemRows = MarketingRewardRedemption::query()
            ->selectRaw('branch_id, COUNT(*) as c')
            ->whereBetween('redeemed_at', [$from, $to])
            ->groupBy('branch_id')
            ->pluck('c', 'branch_id');

        $branchIds = $reviewRows->keys()->merge($redeemRows->keys())->unique();
        if ($branchIds->isEmpty()) {
            return [];
        }

        $names = DB::table('branches')
            ->whereIn('id', $branchIds)
            ->pluck('name', 'id');

        $out = [];
        foreach ($branchIds as $id) {
            $reviews = (int) ($reviewRows[$id] ?? 0);
            $redeemed = (int) ($redeemRows[$id] ?? 0);
            $out[] = [
                'name' => (string) ($names[$id] ?? 'Chi nhánh #'.$id),
                'reviews' => $reviews,
                'redeemed' => $redeemed,
                'ratePct' => $reviews > 0 ? round(($redeemed / $reviews) * 100, 1) : 0.0,
            ];
        }

        usort($out, fn ($a, $b) => $b['reviews'] <=> $a['reviews']);

        return array_slice($out, 0, 5);
    }

    /**
     * @return list<array<string, mixed>>
     */
    protected function listRows(?int $branchId, Carbon $from, Carbon $to): array
    {
        $rows = MarketingReview::query()
            ->with(['channel', 'branch', 'rewardCodes'])
            ->whereBetween('reviewed_at', [$from, $to])
            ->when($branchId, fn (Builder $q) => $q->where('branch_id', $branchId))
            ->orderByDesc('reviewed_at')
            ->orderByDesc('id')
            ->limit(500)
            ->get();

        return $rows->map(function (MarketingReview $r) {
            $code = $r->rewardCodes
                ->sortByDesc(fn ($c) => $c->issued_at?->timestamp ?? 0)
                ->first();

            $giftStatus = match ($r->status) {
                MarketingReview::STATUS_PENDING => 'pending',
                MarketingReview::STATUS_REJECTED => 'rejected',
                MarketingReview::STATUS_VERIFIED => (
                    $code && $code->status === MarketingRewardCode::STATUS_REDEEMED
                        ? 'gifted'
                        : 'ungifted'
                ),
                default => 'pending',
            };

            $customerName = trim((string) ($r->customer_name ?? ''));
            if ($customerName === '') {
                $customerName = $this->guessCustomerName($r) ?? '—';
            }

            return [
                'id' => (string) $r->id,
                'orderCode' => $r->order_code,
                'customerName' => $customerName,
                'customerPhone' => $r->customer_phone ?: '—',
                'channel' => $this->normalizeChannelCode($r->channel?->code),
                'channelLabel' => $r->channel?->name ?? '—',
                'branch' => $r->branch?->name ?? '—',
                'reviewedAt' => optional($r->reviewed_at)?->format('d/m/Y H:i') ?? '—',
                'rating' => (float) $r->rating,
                'giftStatus' => $giftStatus,
                'giftCode' => $code?->code,
                'reviewStatus' => $r->status,
            ];
        })->all();
    }

    protected function normalizeChannelCode(?string $code): string
    {
        $raw = strtolower(trim((string) $code));
        $raw = str_replace(['-', ' '], '_', $raw);

        return match ($raw) {
            'shopee' => 'shopee',
            'shopeefood', 'shopee_food', 'shopee-food' => 'shopee_food',
            'grabfood', 'grab_food', 'grab-food' => 'grab_food',
            default => $raw !== '' ? $raw : 'other',
        };
    }

    protected function guessCustomerName(MarketingReview $review): ?string
    {
        $text = (string) ($review->review_content ?? '');
        $code = preg_quote($review->order_code, '/');
        if ($text !== '' && preg_match('/([A-Za-z0-9._-]{2,40})\s*'.$code.'/u', $text, $m)) {
            return $m[1];
        }

        return null;
    }

    /**
     * @return list<array<string, mixed>>
     */
    protected function latestReviews(?int $branchId, int $limit): array
    {
        $rows = MarketingReview::query()
            ->with(['channel', 'branch'])
            ->when($branchId, fn (Builder $q) => $q->where('branch_id', $branchId))
            ->orderByDesc('reviewed_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get();

        return $rows->map(function (MarketingReview $r) {
            $status = match ($r->status) {
                MarketingReview::STATUS_VERIFIED => 'verified',
                MarketingReview::STATUS_REJECTED => 'rejected',
                default => 'pending',
            };

            return [
                'id' => $r->order_code,
                'rating' => (int) $r->rating,
                'at' => optional($r->reviewed_at)?->format('d/m/Y H:i') ?? '',
                'channel' => strtolower((string) ($r->channel?->code ?? 'other')),
                'branch' => $r->branch?->name ?? '—',
                'status' => $status,
                'thumb' => '⭐',
            ];
        })->all();
    }

    /**
     * @return list<array{id: string, name: string, giftCount: int, initial: string, tone: string}>
     */
    protected function topCustomers(?int $branchId, Carbon $from, Carbon $to): array
    {
        $tones = ['bg-blue-500', 'bg-violet-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];

        $rows = MarketingRewardCode::query()
            ->selectRaw('marketing_reviews.customer_name as name, COUNT(*) as c')
            ->join('marketing_reviews', 'marketing_reviews.id', '=', 'marketing_reward_codes.review_id')
            ->whereBetween('marketing_reward_codes.issued_at', [$from, $to])
            ->when(
                $branchId,
                fn (Builder $q) => $q->where('marketing_reviews.branch_id', $branchId)
            )
            ->whereNotNull('marketing_reviews.customer_name')
            ->where('marketing_reviews.customer_name', '!=', '')
            ->groupBy('marketing_reviews.customer_name')
            ->orderByDesc('c')
            ->limit(5)
            ->get();

        return $rows->values()->map(function ($row, $i) use ($tones) {
            $name = (string) $row->name;
            $initial = mb_strtoupper(mb_substr($name, 0, 1));

            return [
                'id' => 'c-'.$i.'-'.md5($name),
                'name' => $name,
                'giftCount' => (int) $row->c,
                'initial' => $initial,
                'tone' => $tones[$i % count($tones)],
            ];
        })->all();
    }

    protected function campaignPayload(MarketingReviewCampaign $campaign, int $redeemedInRange): array
    {
        $codes = (int) $campaign->reward_codes_count;
        $reviews = (int) $campaign->reviews_count;

        return [
            'id' => (string) $campaign->id,
            'title' => $campaign->name,
            'from' => optional($campaign->start_at)?->format('d/m/Y') ?? '—',
            'to' => optional($campaign->end_at)?->format('d/m/Y') ?? '—',
            'branches' => (int) $campaign->campaign_branches_count,
            'channels' => (int) $campaign->campaign_channels_count,
            'reviews' => $reviews,
            'codes' => $codes,
            'redeemed' => $redeemedInRange,
            'ratePct' => $codes > 0 ? round(($redeemedInRange / $codes) * 100, 1) : 0.0,
            'status' => 'running',
            'thumb' => '🎁',
        ];
    }

    protected function publicReviewPath(?int $campaignId): string
    {
        $qr = MarketingQrCode::query()
            ->where('enabled', true)
            ->when($campaignId, fn (Builder $q) => $q->where('campaign_id', $campaignId))
            ->orderByDesc('id')
            ->first();

        if ($qr) {
            return 'genky.vn/review/verify?token='.$qr->token;
        }

        return 'genky.vn/review/verify';
    }

    protected function deltaPct(int $current, int $previous): float
    {
        if ($previous <= 0) {
            return $current > 0 ? 100.0 : 0.0;
        }

        return round((($current - $previous) / $previous) * 100, 1);
    }
}
