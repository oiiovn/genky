<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MarketingReward extends Model
{
    use BelongsToOrganization;

    protected $fillable = [
        'organization_id',
        'name',
        'description',
        'image',
        'sku',
        'value',
        'display_value',
        'enabled',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'integer',
            'display_value' => 'integer',
            'enabled' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    /** Trị giá hiển thị cho khách khi quay. */
    public function customerDisplayValue(): int
    {
        $display = (int) $this->display_value;

        return $display > 0 ? $display : (int) $this->value;
    }

    public function campaignLinks(): HasMany
    {
        return $this->hasMany(MarketingCampaignReward::class, 'reward_id');
    }

    public function rewardCodes(): HasMany
    {
        return $this->hasMany(MarketingRewardCode::class, 'reward_id');
    }

    public function campaigns(): BelongsToMany
    {
        return $this->belongsToMany(
            MarketingReviewCampaign::class,
            'marketing_campaign_rewards',
            'reward_id',
            'campaign_id',
        )->withPivot(['quantity', 'enabled']);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('sort_order')->orderBy('name');
    }

    public function scopeEnabled(Builder $query): Builder
    {
        return $query->where('enabled', true);
    }

    public function imageUrl(): ?string
    {
        if (! $this->image) {
            return null;
        }

        // Absolute URL đã lưu sẵn
        if (str_starts_with($this->image, 'http://') || str_starts_with($this->image, 'https://')) {
            return $this->image;
        }

        $base = request()?->getSchemeAndHttpHost()
            ?: rtrim((string) config('app.url'), '/');

        return $base.'/storage/'.$this->image;
    }
}
