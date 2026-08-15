<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketingCampaignChannel extends Model
{
    protected $fillable = [
        'campaign_id',
        'channel_id',
        'enabled',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
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
}
