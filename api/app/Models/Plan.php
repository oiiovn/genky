<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    public const FREE = 'free';
    public const STARTER = 'starter';
    public const PRO = 'pro';
    public const BUSINESS = 'business';
    public const ENTERPRISE = 'enterprise';

    protected $fillable = [
        'code',
        'name',
        'description',
        'price_monthly',
        'max_branches',
        'max_employees',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'price_monthly' => 'integer',
            'max_branches' => 'integer',
            'max_employees' => 'integer',
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function features(): BelongsToMany
    {
        return $this->belongsToMany(Feature::class, 'plan_features')
            ->withPivot('enabled')
            ->withTimestamps();
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }
}
