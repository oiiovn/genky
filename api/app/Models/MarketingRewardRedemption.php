<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Audit trail khi đổi mã quà.
 * Đổi status marketing_reward_codes → REDEEMED phải luôn kèm insert bảng này.
 */
class MarketingRewardRedemption extends Model
{
    use BelongsToOrganization;

    public const UPDATED_AT = null;

    protected $fillable = [
        'organization_id',
        'reward_code_id',
        'order_code',
        'review_id',
        'reward_id',
        'branch_id',
        'employee_id',
        'redeemed_at',
        'device_id',
        'ip_address',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'redeemed_at' => 'datetime',
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

    public function reward(): BelongsTo
    {
        return $this->belongsTo(MarketingReward::class, 'reward_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }
}
