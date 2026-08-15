<?php

namespace App\Services\Marketing;

use App\Models\Employee;
use App\Models\MarketingRewardCode;
use App\Models\MarketingRewardRedemption;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MarketingRewardRedemptionService
{
    /**
     * Nhân viên check mã trước khi đổi.
     *
     * @return array<string, mixed>
     */
    public function check(string $code): array
    {
        /** @var MarketingRewardCode|null $row */
        $row = MarketingRewardCode::query()
            ->with([
                'reward',
                'campaign',
                'review.channel',
                'review.branch',
                'redeemedBranch',
            ])
            ->where('code', trim($code))
            ->first();

        if (! $row) {
            throw ValidationException::withMessages([
                'code' => 'Không tìm thấy mã quà.',
            ]);
        }

        $this->syncExpired($row);

        $valid = $row->status === MarketingRewardCode::STATUS_ISSUED
            && ($row->expires_at === null || $row->expires_at->isFuture());

        return [
            'valid' => $valid,
            'id' => $row->id,
            'code' => $row->code,
            'status' => $row->status,
            'expires_at' => optional($row->expires_at)?->toIso8601String(),
            'issued_at' => optional($row->issued_at)?->toIso8601String(),
            'redeemed_at' => optional($row->redeemed_at)?->toIso8601String(),
            'reward' => $row->reward ? [
                'id' => $row->reward->id,
                'name' => $row->reward->name,
                'value' => $row->reward->value,
                'image' => $row->reward->image,
            ] : null,
            'customer' => $row->review ? [
                'name' => $row->review->customer_name,
                'phone' => $row->review->customer_phone,
            ] : null,
            'order' => [
                'order_code' => $row->review?->order_code,
                'rating' => $row->review?->rating,
                'reviewed_at' => optional($row->review?->reviewed_at)?->format('Y-m-d H:i:s'),
            ],
            'branch' => $row->review?->branch ? [
                'id' => $row->review->branch->id,
                'name' => $row->review->branch->name,
            ] : null,
            'campaign' => $row->campaign ? [
                'id' => $row->campaign->id,
                'name' => $row->campaign->name,
                'status' => $row->campaign->status,
            ] : null,
            'channel' => $row->review?->channel ? [
                'id' => $row->review->channel->id,
                'name' => $row->review->channel->name,
                'code' => $row->review->channel->code,
            ] : null,
        ];
    }

    /**
     * Lịch sử đổi quà (tab admin).
     *
     * @return array{redeemStats: array<string, mixed>, redeemRows: list<array<string, mixed>>, from: string, to: string}
     */
    public function history(?int $branchId, ?Carbon $from, ?Carbon $to): array
    {
        $from = ($from ?? now()->subDays(90))->startOfDay();
        $to = ($to ?? now())->endOfDay();

        $base = MarketingRewardRedemption::query()
            ->whereBetween('redeemed_at', [$from, $to])
            ->when($branchId, fn (Builder $q) => $q->where('branch_id', $branchId));

        $total = (clone $base)->count();
        $totalValue = (int) (clone $base)
            ->join('marketing_rewards', 'marketing_rewards.id', '=', 'marketing_reward_redemptions.reward_id')
            ->sum('marketing_rewards.value');

        $rows = MarketingRewardRedemption::query()
            ->with([
                'rewardCode',
                'reward',
                'branch',
                'employee',
                'review.channel',
            ])
            ->whereBetween('redeemed_at', [$from, $to])
            ->when($branchId, fn (Builder $q) => $q->where('branch_id', $branchId))
            ->orderByDesc('redeemed_at')
            ->orderByDesc('id')
            ->limit(500)
            ->get();

        $redeemRows = $rows->map(function (MarketingRewardRedemption $r) {
            $customerName = trim((string) ($r->review?->customer_name ?? ''));
            if ($customerName === '') {
                $customerName = '—';
            }
            $staffName = trim((string) ($r->employee?->full_name ?? ''));
            if ($staffName === '') {
                $staffName = '—';
            }
            $channelCode = strtolower((string) ($r->review?->channel?->code ?? 'other'));
            $channelCode = str_replace(['-', ' '], '_', $channelCode);
            $channel = match ($channelCode) {
                'shopee' => 'shopee',
                'shopeefood', 'shopee_food' => 'shopee_food',
                'grabfood', 'grab_food' => 'grab_food',
                default => $channelCode !== '' ? $channelCode : 'other',
            };

            $giftName = $r->reward?->name ?? 'Quà tặng';
            $giftImageUrl = $r->reward?->imageUrl();

            return [
                'id' => (string) $r->id,
                'giftCode' => $r->rewardCode?->code ?? '—',
                'orderCode' => $r->order_code ?: ($r->review?->order_code ?? '—'),
                'customerName' => $customerName,
                'customerPhone' => $r->review?->customer_phone ?: '—',
                'customerInitial' => mb_strtoupper(mb_substr($customerName === '—' ? '?' : $customerName, 0, 1)),
                'channel' => $channel,
                'channelLabel' => $r->review?->channel?->name,
                'branch' => $r->branch?->name ?? '—',
                'giftName' => $giftName,
                'giftEmoji' => '🎁',
                'giftImageUrl' => $giftImageUrl,
                'giftPrice' => (int) ($r->reward?->value ?? 0),
                'redeemedAt' => optional($r->redeemed_at)?->format('d/m/Y H:i') ?? '—',
                'staffName' => $staffName,
                'staffInitial' => mb_strtoupper(mb_substr($staffName === '—' ? '?' : $staffName, 0, 1)),
                'status' => 'success',
                'note' => $r->note,
            ];
        })->all();

        return [
            'redeemStats' => [
                'total' => $total,
                'success' => $total,
                'successPct' => $total > 0 ? 100.0 : 0.0,
                'processing' => 0,
                'processingPct' => 0.0,
                'failed' => 0,
                'failedPct' => 0.0,
                'totalValue' => $totalValue,
            ],
            'redeemRows' => $redeemRows,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
        ];
    }

    /**
     * Đổi quà — transaction + lockForUpdate, bắt buộc tạo redemption.
     *
     * @param  array{branch_id: int, note?: ?string, device_id?: ?string, ip_address?: ?string}  $data
     * @return array{reward_code: MarketingRewardCode, redemption: MarketingRewardRedemption}
     */
    public function redeem(int $rewardCodeId, array $data, User $user): array
    {
        return DB::transaction(function () use ($rewardCodeId, $data, $user) {
            /** @var MarketingRewardCode $code */
            $code = MarketingRewardCode::query()
                ->with(['review', 'reward'])
                ->whereKey($rewardCodeId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($code->status !== MarketingRewardCode::STATUS_ISSUED) {
                throw ValidationException::withMessages([
                    'status' => $code->status === MarketingRewardCode::STATUS_REDEEMED
                        ? 'Mã đã được đổi.'
                        : 'Mã không ở trạng thái ISSUED.',
                ]);
            }

            if ($code->expires_at && $code->expires_at->isPast()) {
                $code->status = MarketingRewardCode::STATUS_EXPIRED;
                $code->save();

                throw ValidationException::withMessages([
                    'expires_at' => 'Mã đã hết hạn.',
                ]);
            }

            $branchId = (int) $data['branch_id'];
            $this->assertBranchPermission($user, $branchId, $code);

            $employee = Employee::query()
                ->where('user_id', $user->id)
                ->first();

            $now = now();

            $redemption = MarketingRewardRedemption::query()->create([
                'organization_id' => $code->organization_id,
                'reward_code_id' => $code->id,
                'order_code' => $code->review?->order_code,
                'review_id' => $code->review_id,
                'reward_id' => $code->reward_id,
                'branch_id' => $branchId,
                'employee_id' => $employee?->id,
                'redeemed_at' => $now,
                'device_id' => $data['device_id'] ?? null,
                'ip_address' => $data['ip_address'] ?? null,
                'note' => $data['note'] ?? null,
            ]);

            $code->status = MarketingRewardCode::STATUS_REDEEMED;
            $code->redeemed_at = $now;
            $code->redeemed_branch_id = $branchId;
            $code->redeemed_by = $user->id;
            $code->save();

            return [
                'reward_code' => $code->fresh(['reward', 'review', 'campaign']),
                'redemption' => $redemption,
            ];
        });
    }

    protected function syncExpired(MarketingRewardCode $row): void
    {
        if ($row->status === MarketingRewardCode::STATUS_ISSUED
            && $row->expires_at
            && $row->expires_at->isPast()
        ) {
            $row->status = MarketingRewardCode::STATUS_EXPIRED;
            $row->save();
        }
    }

    protected function assertBranchPermission(
        User $user,
        int $branchId,
        MarketingRewardCode $code,
    ): void {
        // Chi nhánh phải thuộc org (tenant scope Branch).
        $branchOk = \App\Models\Branch::query()->whereKey($branchId)->exists();
        if (! $branchOk) {
            throw ValidationException::withMessages([
                'branch_id' => 'Chi nhánh không hợp lệ.',
            ]);
        }

        // Nếu review gắn chi nhánh — ưu tiên đổi tại đúng chi nhánh (cảnh báo mềm: bắt buộc khớp).
        if ($code->review?->branch_id && (int) $code->review->branch_id !== $branchId) {
            throw ValidationException::withMessages([
                'branch_id' => 'Chi nhánh đổi quà không khớp chi nhánh của đánh giá.',
            ]);
        }
    }
}
