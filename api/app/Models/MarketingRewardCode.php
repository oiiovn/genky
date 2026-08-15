<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MarketingRewardCode extends Model
{
    use BelongsToOrganization;

    public const STATUS_ISSUED = 'ISSUED';
    public const STATUS_REDEEMED = 'REDEEMED';
    public const STATUS_EXPIRED = 'EXPIRED';
    public const STATUS_CANCELLED = 'CANCELLED';

    public const STATUSES = [
        self::STATUS_ISSUED,
        self::STATUS_REDEEMED,
        self::STATUS_EXPIRED,
        self::STATUS_CANCELLED,
    ];

    protected $fillable = [
        'organization_id',
        'campaign_id',
        'review_id',
        'reward_id',
        'code',
        'status',
        'issued_at',
        'expires_at',
        'redeemed_at',
        'redeemed_branch_id',
        'redeemed_by',
    ];

    protected function casts(): array
    {
        return [
            'issued_at' => 'datetime',
            'expires_at' => 'datetime',
            'redeemed_at' => 'datetime',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(MarketingReviewCampaign::class, 'campaign_id');
    }

    public function review(): BelongsTo
    {
        return $this->belongsTo(MarketingReview::class, 'review_id');
    }

    public function reward(): BelongsTo
    {
        return $this->belongsTo(MarketingReward::class, 'reward_id');
    }

    public function redeemedBranch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'redeemed_branch_id');
    }

    public function redeemer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'redeemed_by');
    }

    /** Audit trail đổi quà — bắt buộc khi đánh dấu REDEEMED. */
    public function redemptions(): HasMany
    {
        return $this->hasMany(MarketingRewardRedemption::class, 'reward_code_id');
    }

    public function scopeStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    public function scopeIssued(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ISSUED);
    }

    public function scopeRedeemed(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_REDEEMED);
    }
}
