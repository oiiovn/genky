<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    use BelongsToOrganization;

    protected $fillable = [
        'organization_id',
        'slug',
        'name',
        'description',
        'icon',
        'color',
        'bg',
        'is_system',
        'is_default',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_system' => 'boolean',
            'is_default' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function permissions(): HasMany
    {
        return $this->hasMany(RolePermission::class);
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class);
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'role_user')
            ->withPivot(['organization_id'])
            ->withTimestamps();
    }
}
