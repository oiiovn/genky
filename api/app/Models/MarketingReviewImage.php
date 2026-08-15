<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MarketingReviewImage extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'review_id',
        'file_path',
        'file_url',
        'mime_type',
        'sort_order',
        'ocr_status',
        'ocr_data',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'ocr_data' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function review(): BelongsTo
    {
        return $this->belongsTo(MarketingReview::class, 'review_id');
    }
}
