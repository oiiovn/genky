<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use App\Support\AppTimezone;
use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MarketingFlashSale extends Model
{
    use BelongsToOrganization;

    public const STATUS_RUNNING = 'running';

    public const STATUS_UPCOMING = 'upcoming';

    public const STATUS_ENDED = 'ended';

    public const BANNERS = ['88', '99', 'mid', 'end'];

    protected $fillable = [
        'organization_id',
        'branch_id',
        'title',
        'banner',
        'starts_at',
        'ends_at',
        'slots',
        'quota',
        'sold_count',
        'revenue',
        'ended_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'ended_at' => 'datetime',
            'slots' => 'array',
            'quota' => 'integer',
            'sold_count' => 'integer',
            'revenue' => 'integer',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function products(): HasMany
    {
        return $this->hasMany(MarketingFlashSaleProduct::class, 'flash_sale_id')
            ->orderBy('sort_order')
            ->orderBy('id');
    }

    public function computedStatus(?Carbon $now = null): string
    {
        $now ??= now(AppTimezone::ZONE);

        if ($this->ended_at !== null || $this->ends_at === null || $now->gt($this->ends_at)) {
            return self::STATUS_ENDED;
        }

        if ($this->starts_at !== null && $now->lt($this->starts_at)) {
            return self::STATUS_UPCOMING;
        }

        return self::STATUS_RUNNING;
    }
}
