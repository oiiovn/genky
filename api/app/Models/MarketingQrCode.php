<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketingQrCode extends Model
{
    use BelongsToOrganization;

    public const DESTINATION_ORDER_VERIFY = 'ORDER_VERIFY';
    public const DESTINATION_LANDING_PAGE = 'LANDING_PAGE';
    public const DESTINATION_CUSTOM_URL = 'CUSTOM_URL';

    public const DESTINATION_TYPES = [
        self::DESTINATION_ORDER_VERIFY,
        self::DESTINATION_LANDING_PAGE,
        self::DESTINATION_CUSTOM_URL,
    ];

    /** Path mặc định khi destination_type = ORDER_VERIFY. */
    public const ORDER_VERIFY_PATH = '/review/verify';

    protected $fillable = [
        'organization_id',
        'campaign_id',
        'name',
        'branch_id',
        'channel_id',
        'token',
        'destination_type',
        'destination_url',
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

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class, 'branch_id');
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(MarketingChannel::class, 'channel_id');
    }

    public function scopeEnabled(Builder $query): Builder
    {
        return $query->where('enabled', true);
    }

    public function resolvedDestinationUrl(): ?string
    {
        return match ($this->destination_type) {
            self::DESTINATION_ORDER_VERIFY => $this->destination_url ?: self::ORDER_VERIFY_PATH,
            self::DESTINATION_LANDING_PAGE,
            self::DESTINATION_CUSTOM_URL => $this->destination_url,
            default => $this->destination_url,
        };
    }
}
