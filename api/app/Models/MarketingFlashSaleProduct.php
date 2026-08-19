<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketingFlashSaleProduct extends Model
{
    use BelongsToOrganization;

    protected $fillable = [
        'organization_id',
        'flash_sale_id',
        'name',
        'image',
        'emoji',
        'tone',
        'slot_start',
        'slot_end',
        'price',
        'original_price',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'price' => 'integer',
            'original_price' => 'integer',
            'sort_order' => 'integer',
        ];
    }

    public function flashSale(): BelongsTo
    {
        return $this->belongsTo(MarketingFlashSale::class, 'flash_sale_id');
    }

    public function imageUrl(): ?string
    {
        if (! $this->image) {
            return null;
        }

        if (str_starts_with($this->image, 'http://') || str_starts_with($this->image, 'https://')) {
            return $this->image;
        }

        $base = request()?->getSchemeAndHttpHost()
            ?: rtrim((string) config('app.url'), '/');

        return $base.'/storage/'.$this->image;
    }
}
