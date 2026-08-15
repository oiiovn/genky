<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketingCampaignBranch extends Model
{
    protected $fillable = [
        'campaign_id',
        'branch_id',
    ];

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(MarketingReviewCampaign::class, 'campaign_id');
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
