<?php

namespace App\Services\Marketing;

use App\Models\MarketingReviewCampaign;
use App\Models\MarketingRewardCodeSetting;
use Illuminate\Validation\ValidationException;

class MarketingReviewCampaignService
{
    /**
     * @return array{checklist: array<string, bool>, missing: list<string>, ready: bool}
     */
    public function readiness(MarketingReviewCampaign $campaign): array
    {
        $campaign->loadMissing([
            'campaignBranches',
            'campaignChannels',
            'campaignRewards',
            'qrCodes',
        ]);

        $hasName = trim((string) $campaign->name) !== '';
        $hasBranches = $campaign->campaignBranches->isNotEmpty();
        $hasChannels = $campaign->campaignChannels
            ->contains(fn ($row) => (bool) $row->enabled);
        $hasRewards = $campaign->campaignRewards
            ->contains(fn ($row) => (bool) $row->enabled);
        $hasSchedule = $campaign->start_at !== null
            && $campaign->end_at !== null
            && $campaign->end_at->gte($campaign->start_at);
        $hasQr = $campaign->qrCodes->contains(fn ($row) => (bool) $row->enabled);
        $hasCodeConfig = $this->hasCodeConfig((int) $campaign->organization_id);

        $checklist = [
            'name' => $hasName,
            'branches' => $hasBranches,
            'channels' => $hasChannels,
            'rewards' => $hasRewards,
            'schedule' => $hasSchedule,
            'qr' => $hasQr,
            'code_config' => $hasCodeConfig,
        ];

        $missing = array_values(array_keys(array_filter(
            $checklist,
            fn (bool $ok) => ! $ok,
        )));

        return [
            'checklist' => $checklist,
            'missing' => $missing,
            'ready' => $missing === [],
        ];
    }

    public function activate(MarketingReviewCampaign $campaign): MarketingReviewCampaign
    {
        if ($campaign->status !== MarketingReviewCampaign::STATUS_DRAFT) {
            throw ValidationException::withMessages([
                'status' => 'Chỉ chiến dịch ở trạng thái DRAFT mới được kích hoạt.',
            ]);
        }

        $readiness = $this->readiness($campaign);

        if (! $readiness['ready']) {
            throw new CampaignNotReadyException(
                $readiness['missing'],
                $readiness['checklist'],
            );
        }

        $campaign->status = MarketingReviewCampaign::STATUS_ACTIVE;
        $campaign->save();

        return $campaign->fresh([
            'campaignBranches',
            'campaignChannels',
            'campaignRewards',
            'qrCodes',
        ]) ?? $campaign;
    }

    public function payload(MarketingReviewCampaign $campaign): array
    {
        $readiness = $this->readiness($campaign);

        return [
            'id' => $campaign->id,
            'organization_id' => $campaign->organization_id,
            'name' => $campaign->name,
            'description' => $campaign->description,
            'status' => $campaign->status,
            'start_at' => optional($campaign->start_at)?->toIso8601String(),
            'end_at' => optional($campaign->end_at)?->toIso8601String(),
            'min_rating' => $campaign->min_rating,
            'max_reward_per_order' => $campaign->max_reward_per_order,
            'max_reward_per_customer' => $campaign->max_reward_per_customer,
            'auto_verify' => $campaign->auto_verify,
            'auto_issue_reward' => $campaign->auto_issue_reward,
            'created_by' => $campaign->created_by,
            'branch_ids' => $campaign->campaignBranches->pluck('branch_id')->values(),
            'channel_ids' => $campaign->campaignChannels
                ->where('enabled', true)
                ->pluck('channel_id')
                ->values(),
            'reward_ids' => $campaign->campaignRewards
                ->where('enabled', true)
                ->pluck('reward_id')
                ->values(),
            'qr_count' => $campaign->qrCodes->where('enabled', true)->count(),
            'readiness' => $readiness,
            'created_at' => optional($campaign->created_at)?->toIso8601String(),
            'updated_at' => optional($campaign->updated_at)?->toIso8601String(),
        ];
    }

    protected function hasCodeConfig(int $organizationId): bool
    {
        $settings = MarketingRewardCodeSetting::query()
            ->where('organization_id', $organizationId)
            ->first();

        if (! $settings) {
            return false;
        }

        if (trim((string) $settings->prefix) === '') {
            return false;
        }

        if ((int) $settings->length < 1) {
            return false;
        }

        if (! $settings->use_letters && ! $settings->use_numbers) {
            return false;
        }

        $type = strtoupper((string) $settings->expiry_type);

        return match ($type) {
            'DAYS', 'AFTER_DAYS' => (int) $settings->expiry_days > 0,
            'DATE', 'FIXED_DATE' => $settings->expiry_date !== null,
            'NEVER' => true,
            default => (int) $settings->expiry_days > 0 || $settings->expiry_date !== null,
        };
    }
}
