<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class Organization extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'phone',
        'address',
        'tax_code',
        'company_type',
        'company_size',
        'email',
        'website',
        'fax',
        'hotline',
        'representative',
        'representative_title',
        'established_at',
        'industry',
        'intro',
        'logo_path',
        'owner_id',
        'timezone',
        'locale',
        'settings',
        'setup_completed_at',
    ];

    protected function casts(): array
    {
        return [
            'settings' => 'array',
            'setup_completed_at' => 'datetime',
            'established_at' => 'date',
        ];
    }

    public function logoUrl(): ?string
    {
        if (! $this->logo_path) {
            return null;
        }

        $base = request()?->getSchemeAndHttpHost()
            ?: rtrim((string) config('app.url'), '/');

        return $base.'/storage/'.$this->logo_path;
    }

    public static function makeSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'org';
        $slug = $base;
        $i = 1;

        while (static::query()->where('slug', $slug)->exists()) {
            $slug = $base.'-'.$i;
            $i++;
        }

        return $slug;
    }

    public function isSetupCompleted(): bool
    {
        return $this->setup_completed_at !== null;
    }

    public function hasOrganizationProfile(): bool
    {
        return filled($this->name) && filled($this->phone) && filled($this->address);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->withPivot(['role', 'is_default'])
            ->withTimestamps();
    }

    public function memberships(): HasMany
    {
        return $this->hasMany(OrganizationUser::class);
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Branch::class);
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class);
    }

    public function positions(): HasMany
    {
        return $this->hasMany(Position::class);
    }

    public function documents(): HasMany
    {
        return $this->hasMany(OrganizationDocument::class);
    }

    public function subscriptions(): HasMany
    {
        return $this->hasMany(Subscription::class);
    }

    public function activeSubscription(): \Illuminate\Database\Eloquent\Relations\HasOne
    {
        return $this->hasOne(Subscription::class)
            ->whereIn('status', [Subscription::STATUS_ACTIVE, Subscription::STATUS_TRIALING])
            ->latestOfMany();
    }
}
