<?php

namespace App\Services\Marketing;

use App\Models\Branch;
use App\Models\MarketingCampaignBranch;
use App\Models\MarketingCampaignChannel;
use App\Models\MarketingChannel;
use App\Models\MarketingReviewCampaign;
use App\Models\MarketingRewardCodeSetting;
use App\Support\Tenancy\TenantContext;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MarketingReviewCampaignService
{
    public const DEFAULT_NAME = 'Mặc định';

    public function __construct(
        private readonly MarketingChannelService $channels,
    ) {
    }

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

    /**
     * Đảm bảo org có 1 chiến dịch ACTIVE dài hạn để thêm đánh giá.
     * Không đụng campaign active sẵn; chỉ tạo/kích hoạt “Mặc định” khi thiếu.
     */
    public function ensureDefaultActiveCampaign(): MarketingReviewCampaign
    {
        $active = MarketingReviewCampaign::query()
            ->where('status', MarketingReviewCampaign::STATUS_ACTIVE)
            ->orderByDesc('start_at')
            ->orderByDesc('id')
            ->first();

        if ($active) {
            return $active;
        }

        return DB::transaction(function () {
            $locked = MarketingReviewCampaign::query()
                ->where('status', MarketingReviewCampaign::STATUS_ACTIVE)
                ->lockForUpdate()
                ->orderByDesc('id')
                ->first();

            if ($locked) {
                return $locked;
            }

            $campaign = MarketingReviewCampaign::query()
                ->where('name', self::DEFAULT_NAME)
                ->whereIn('status', [
                    MarketingReviewCampaign::STATUS_DRAFT,
                    MarketingReviewCampaign::STATUS_PAUSED,
                    MarketingReviewCampaign::STATUS_ENDED,
                ])
                ->orderByDesc('id')
                ->lockForUpdate()
                ->first();

            $orgId = (int) TenantContext::id();
            if (! $orgId) {
                throw ValidationException::withMessages([
                    'campaign' => 'Thiếu tổ chức để tạo chiến dịch mặc định.',
                ]);
            }

            $payload = [
                'organization_id' => $orgId,
                'name' => self::DEFAULT_NAME,
                'description' => 'Chiến dịch mặc định dài hạn — tự tạo để thêm đánh giá.',
                'status' => MarketingReviewCampaign::STATUS_ACTIVE,
                'start_at' => Carbon::parse('2020-01-01 00:00:00', 'Asia/Ho_Chi_Minh'),
                'end_at' => Carbon::parse('2037-12-31 23:59:59', 'Asia/Ho_Chi_Minh'),
                'min_rating' => 1,
                'auto_verify' => false,
                'auto_issue_reward' => false,
                'created_by' => auth()->id(),
            ];

            if ($campaign) {
                $campaign->fill($payload)->save();
            } else {
                $campaign = MarketingReviewCampaign::query()->create($payload);
            }

            $this->attachOrgScope($campaign);

            return $campaign->fresh([
                'campaignBranches',
                'campaignChannels',
            ]) ?? $campaign;
        });
    }

    protected function attachOrgScope(MarketingReviewCampaign $campaign): void
    {
        $this->channels->seedDefaultsIfEmpty();

        $branchIds = Branch::query()
            ->where('is_active', true)
            ->pluck('id');
        if ($branchIds->isEmpty()) {
            $branchIds = Branch::query()->pluck('id');
        }

        foreach ($branchIds as $branchId) {
            MarketingCampaignBranch::query()->firstOrCreate([
                'campaign_id' => $campaign->id,
                'branch_id' => $branchId,
            ]);
        }

        $channelIds = MarketingChannel::query()
            ->where('enabled', true)
            ->pluck('id');

        foreach ($channelIds as $channelId) {
            MarketingCampaignChannel::query()->firstOrCreate(
                [
                    'campaign_id' => $campaign->id,
                    'channel_id' => $channelId,
                ],
                ['enabled' => true],
            );
        }
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
