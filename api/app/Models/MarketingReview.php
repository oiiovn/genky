<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MarketingReview extends Model
{
    use BelongsToOrganization;

    public const STATUS_PENDING = 'PENDING';
    public const STATUS_VERIFIED = 'VERIFIED';
    public const STATUS_REJECTED = 'REJECTED';

    public const STATUSES = [
        self::STATUS_PENDING,
        self::STATUS_VERIFIED,
        self::STATUS_REJECTED,
    ];

    protected $fillable = [
        'organization_id',
        'campaign_id',
        'order_code',
        'customer_name',
        'customer_phone',
        'channel_id',
        'branch_id',
        'rating',
        'review_content',
        'reviewed_at',
        'source',
        'source_reference',
        'status',
        'submitted_by',
        'verified_by',
        'verified_at',
        'rejection_reason',
    ];

    protected function casts(): array
    {
        return [
            'rating' => 'integer',
            'reviewed_at' => 'datetime',
            'verified_at' => 'datetime',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(MarketingReviewCampaign::class, 'campaign_id');
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(MarketingChannel::class, 'channel_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    public function images(): HasMany
    {
        return $this->hasMany(MarketingReviewImage::class, 'review_id')
            ->orderBy('sort_order');
    }

    /** Mã quà phát từ review này — entity riêng, không gộp vào status review. */
    public function rewardCodes(): HasMany
    {
        return $this->hasMany(MarketingRewardCode::class, 'review_id');
    }

    public function scopeStatus(Builder $query, string $status): Builder
    {
        return $query->where('status', $status);
    }

    public function scopePending(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_PENDING);
    }

    public function scopeVerified(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_VERIFIED);
    }
}
