<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketingRewardClaimSession extends Model
{
    use BelongsToOrganization;

    public const UPDATED_AT = null;

    /** Thời hạn claim token (phút). */
    public const TTL_MINUTES = 10;

    protected $fillable = [
        'organization_id',
        'reward_code_id',
        'review_id',
        'token',
        'expires_at',
        'consumed_at',
        'ip_address',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'consumed_at' => 'datetime',
            'created_at' => 'datetime',
        ];
    }

    public function rewardCode(): BelongsTo
    {
        return $this->belongsTo(MarketingRewardCode::class, 'reward_code_id');
    }

    public function review(): BelongsTo
    {
        return $this->belongsTo(MarketingReview::class, 'review_id');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }

    public function isConsumed(): bool
    {
        return $this->consumed_at !== null;
    }
}
