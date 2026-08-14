<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class FeatureFlag extends Model
{
    protected $fillable = [
        'key',
        'name',
        'feature_id',
        'enabled_globally',
        'description',
    ];

    protected function casts(): array
    {
        return [
            'enabled_globally' => 'boolean',
        ];
    }

    public function feature(): BelongsTo
    {
        return $this->belongsTo(Feature::class);
    }

    public function organizations(): BelongsToMany
    {
        return $this->belongsToMany(Organization::class, 'feature_flag_organization')
            ->withPivot('enabled')
            ->withTimestamps();
    }
}
