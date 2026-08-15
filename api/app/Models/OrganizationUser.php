<?php

namespace App\Models;

use App\Support\Access\AccessCache;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrganizationUser extends Model
{
    protected $table = 'organization_user';

    public const ROLE_OWNER = 'owner';
    public const ROLE_ADMIN = 'admin';
    public const ROLE_MANAGER = 'manager';
    public const ROLE_HR = 'hr';
    public const ROLE_EMPLOYEE = 'employee';

    protected $fillable = [
        'organization_id',
        'user_id',
        'role',
        'is_default',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        $flush = function (OrganizationUser $row): void {
            AccessCache::bumpPermissions((int) $row->organization_id);
        };

        static::saved($flush);
        static::deleted($flush);
    }

    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
