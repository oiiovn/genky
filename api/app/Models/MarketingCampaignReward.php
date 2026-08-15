<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketingCampaignReward extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'campaign_id',
        'reward_id',
        'quantity',
        'enabled',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'integer',
            'enabled' => 'boolean',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(MarketingReviewCampaign::class, 'campaign_id');
    }

    public function reward(): BelongsTo
    {
        return $this->belongsTo(MarketingReward::class, 'reward_id');
    }
}
