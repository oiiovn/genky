<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use App\Support\Access\AccessCache;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Employee extends Model
{
    use BelongsToOrganization;

    public const STATUS_ACTIVE = 'active';
    public const STATUS_INACTIVE = 'inactive';
    public const STATUS_RESIGNED = 'resigned';

    protected $fillable = [
        'organization_id',
        'user_id',
        'employee_code',
        'full_name',
        'phone',
        'email',
        'avatar',
        'gender',
        'date_of_birth',
        'address',
        'identity_number',
        'position_id',
        'role_id',
        'employment_type',
        'salary_type',
        'salary_amount',
        'joined_at',
        'resigned_at',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'date_of_birth' => 'date',
            'joined_at' => 'date',
            'resigned_at' => 'date',
            'salary_amount' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saved(function (Employee $employee): void {
            if ($employee->wasRecentlyCreated || $employee->wasChanged(['role_id', 'user_id'])) {
                AccessCache::bumpPermissions((int) $employee->organization_id);
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function position(): BelongsTo
    {
        return $this->belongsTo(Position::class);
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function branches(): BelongsToMany
    {
        return $this->belongsToMany(Branch::class, 'employee_branches')
            ->withPivot(['is_primary', 'assigned_at'])
            ->withTimestamps();
    }

    public function invitations(): HasMany
    {
        return $this->hasMany(EmployeeInvitation::class);
    }

    public function primaryBranch(): ?Branch
    {
        return $this->branches()->wherePivot('is_primary', true)->first()
            ?? $this->branches()->first();
    }
}
