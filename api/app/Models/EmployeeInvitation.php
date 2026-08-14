<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeInvitation extends Model
{
    use BelongsToOrganization;

    protected $fillable = [
        'organization_id',
        'employee_id',
        'invited_by',
        'email',
        'token',
        'expires_at',
        'accepted_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'accepted_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function inviter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    public function isValid(): bool
    {
        return $this->accepted_at === null
            && $this->expires_at !== null
            && $this->expires_at->isFuture();
    }
}
