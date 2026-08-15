<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MarketingReviewCampaign extends Model
{
    use BelongsToOrganization;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_ACTIVE = 'active';
    public const STATUS_PAUSED = 'paused';
    public const STATUS_ENDED = 'ended';
    public const STATUS_ARCHIVED = 'archived';

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_ACTIVE,
        self::STATUS_PAUSED,
        self::STATUS_ENDED,
        self::STATUS_ARCHIVED,
    ];

    protected $fillable = [
        'organization_id',
        'name',
        'description',
        'status',
        'start_at',
        'end_at',
        'min_rating',
        'max_reward_per_order',
        'max_reward_per_customer',
        'auto_verify',
        'auto_issue_reward',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'start_at' => 'datetime',
            'end_at' => 'datetime',
            'min_rating' => 'integer',
            'max_reward_per_order' => 'integer',
            'max_reward_per_customer' => 'integer',
            'auto_verify' => 'boolean',
            'auto_issue_reward' => 'boolean',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function campaignBranches(): HasMany
    {
        return $this->hasMany(MarketingCampaignBranch::class, 'campaign_id');
    }

    public function campaignChannels(): HasMany
    {
        return $this->hasMany(MarketingCampaignChannel::class, 'campaign_id');
    }

    public function campaignRewards(): HasMany
    {
        return $this->hasMany(MarketingCampaignReward::class, 'campaign_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(MarketingReview::class, 'campaign_id');
    }

    public function rewardCodes(): HasMany
    {
        return $this->hasMany(MarketingRewardCode::class, 'campaign_id');
    }

    public function qrCodes(): HasMany
    {
        return $this->hasMany(MarketingQrCode::class, 'campaign_id');
    }

    public function branches(): BelongsToMany
    {
        return $this->belongsToMany(
            Branch::class,
            'marketing_campaign_branches',
            'campaign_id',
            'branch_id',
        );
    }

    public function channels(): BelongsToMany
    {
        return $this->belongsToMany(
            MarketingChannel::class,
            'marketing_campaign_channels',
            'campaign_id',
            'channel_id',
        )->withPivot('enabled');
    }

    public function rewards(): BelongsToMany
    {
        return $this->belongsToMany(
            MarketingReward::class,
            'marketing_campaign_rewards',
            'campaign_id',
            'reward_id',
        )->withPivot(['quantity', 'enabled']);
    }
}
