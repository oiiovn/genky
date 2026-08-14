<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimesheetApproval extends Model
{
    use BelongsToOrganization;

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';

    protected $fillable = [
        'organization_id',
        'employee_id',
        'year',
        'month',
        'status',
        'approved_by',
        'approved_at',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'month' => 'integer',
            'approved_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
