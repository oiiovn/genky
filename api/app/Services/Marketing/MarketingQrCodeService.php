<?php

namespace App\Services\Marketing;

use App\Models\Branch;
use App\Models\MarketingQrCode;
use App\Models\MarketingReviewCampaign;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class MarketingQrCodeService
{
    /**
     * Đảm bảo mỗi chi nhánh có 1 QR ORDER_VERIFY riêng cho chiến dịch active.
     *
     * @return list<array<string, mixed>>
     */
    public function ensureBranchQrsForActiveCampaign(): array
    {
        $campaign = MarketingReviewCampaign::query()
            ->where('status', MarketingReviewCampaign::STATUS_ACTIVE)
            ->orderByDesc('start_at')
            ->orderByDesc('id')
            ->first();

        if (! $campaign) {
            throw ValidationException::withMessages([
                'campaign' => 'Chưa có chiến dịch đang chạy. Kích hoạt chiến dịch trước.',
            ]);
        }

        $branchIds = $campaign->campaignBranches()->pluck('branch_id')->all();
        $branches = Branch::query()
            ->when(
                $branchIds !== [],
                fn ($q) => $q->whereIn('id', $branchIds),
                fn ($q) => $q->where('is_active', true),
            )
            ->orderBy('name')
            ->get();

        if ($branches->isEmpty()) {
            throw ValidationException::withMessages([
                'branch' => 'Chưa có chi nhánh để tạo QR.',
            ]);
        }

        foreach ($branches as $branch) {
            $existing = MarketingQrCode::query()
                ->where('campaign_id', $campaign->id)
                ->where('branch_id', $branch->id)
                ->where('destination_type', MarketingQrCode::DESTINATION_ORDER_VERIFY)
                ->first();

            if ($existing) {
                if (! $existing->enabled) {
                    $existing->enabled = true;
                    $existing->save();
                }
                continue;
            }

            MarketingQrCode::query()->create([
                'campaign_id' => $campaign->id,
                'name' => 'QR nhập mã · '.$branch->name,
                'branch_id' => $branch->id,
                'channel_id' => null,
                'token' => $this->uniqueToken(),
                'destination_type' => MarketingQrCode::DESTINATION_ORDER_VERIFY,
                'destination_url' => MarketingQrCode::ORDER_VERIFY_PATH,
                'enabled' => true,
            ]);
        }

        return $this->listBranchQrs($campaign->id);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listBranchQrs(?int $campaignId = null): array
    {
        if ($campaignId === null) {
            $campaignId = MarketingReviewCampaign::query()
                ->where('status', MarketingReviewCampaign::STATUS_ACTIVE)
                ->orderByDesc('start_at')
                ->orderByDesc('id')
                ->value('id');
        }

        if (! $campaignId) {
            return [];
        }

        return MarketingQrCode::query()
            ->with('branch:id,name')
            ->where('campaign_id', $campaignId)
            ->where('destination_type', MarketingQrCode::DESTINATION_ORDER_VERIFY)
            ->whereNotNull('branch_id')
            ->orderBy('id')
            ->get()
            ->map(fn (MarketingQrCode $qr) => $this->payload($qr))
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    public function payload(MarketingQrCode $qr): array
    {
        $publicUrl = $this->publicVerifyUrl($qr->token);

        return [
            'id' => $qr->id,
            'campaign_id' => $qr->campaign_id,
            'branch_id' => $qr->branch_id,
            'branch_name' => $qr->branch?->name ?? 'Chi nhánh',
            'name' => $qr->name,
            'token' => $qr->token,
            'destination_type' => $qr->destination_type,
            'enabled' => (bool) $qr->enabled,
            'public_url' => $publicUrl,
            'public_path' => MarketingQrCode::ORDER_VERIFY_PATH.'?token='.$qr->token,
        ];
    }

    public function publicVerifyUrl(string $token): string
    {
        $base = rtrim((string) config('app.frontend_url', config('app.url')), '/');

        return $base.MarketingQrCode::ORDER_VERIFY_PATH.'?token='.$token;
    }

    protected function uniqueToken(): string
    {
        do {
            $token = Str::lower(Str::random(32));
        } while (
            MarketingQrCode::withoutGlobalScopes()
                ->where('token', $token)
                ->exists()
        );

        return $token;
    }
}
