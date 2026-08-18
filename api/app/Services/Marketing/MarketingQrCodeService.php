<?php

namespace App\Services\Marketing;

use App\Models\Branch;
use App\Models\MarketingQrCode;
use App\Support\Tenancy\TenantContext;
use Illuminate\Validation\ValidationException;

class MarketingQrCodeService
{
    public function __construct(
        private readonly MarketingReviewCampaignService $campaigns,
    ) {
    }

    /**
     * Đảm bảo mỗi chi nhánh có 1 QR ORDER_VERIFY riêng cho chiến dịch active.
     *
     * @return list<array<string, mixed>>
     */
    public function ensureBranchQrsForActiveCampaign(): array
    {
        $campaign = $this->campaigns->ensureDefaultActiveCampaign();

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
                ->where('branch_id', $branch->id)
                ->where('destination_type', MarketingQrCode::DESTINATION_ORDER_VERIFY)
                ->orderBy('id')
                ->first();

            if ($existing) {
                $dirty = false;
                if ((int) $existing->campaign_id !== (int) $campaign->id) {
                    $existing->campaign_id = $campaign->id;
                    $dirty = true;
                }
                if (! $existing->enabled) {
                    $existing->enabled = true;
                    $dirty = true;
                }
                $name = 'QR nhập mã · '.$branch->name;
                if ($existing->name !== $name) {
                    $existing->name = $name;
                    $dirty = true;
                }
                if ($dirty) {
                    $existing->save();
                }

                continue;
            }

            MarketingQrCode::query()->create([
                'campaign_id' => $campaign->id,
                'name' => 'QR nhập mã · '.$branch->name,
                'branch_id' => $branch->id,
                'channel_id' => null,
                'token' => $this->uniqueTokenForBranch(
                    (int) ($branch->organization_id ?: TenantContext::id() ?: 0),
                    (int) $branch->id,
                ),
                'destination_type' => MarketingQrCode::DESTINATION_ORDER_VERIFY,
                'destination_url' => MarketingQrCode::ORDER_VERIFY_PATH,
                'enabled' => true,
            ]);
        }

        return $this->listBranchQrs();
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listBranchQrs(?int $campaignId = null): array
    {

        return MarketingQrCode::query()
            ->with('branch:id,name')
            ->where('destination_type', MarketingQrCode::DESTINATION_ORDER_VERIFY)
            ->whereNotNull('branch_id')
            ->orderBy('id')
            ->get()
            ->unique('branch_id')
            ->values()
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

    protected function uniqueTokenForBranch(int $organizationId, int $branchId): string
    {
        $n = 0;
        do {
            $token = substr(hash('sha256', "genky-mkt-qr:{$organizationId}:{$branchId}:{$n}"), 0, 8);
            $n++;
        } while (
            MarketingQrCode::withoutGlobalScopes()
                ->where('token', $token)
                ->exists()
        );

        return $token;
    }
}
