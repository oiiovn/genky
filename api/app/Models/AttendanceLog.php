<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AttendanceLog extends Model
{
    use BelongsToOrganization;

    public const STATUS_WORKING = 'working';
    public const STATUS_CHECKED_OUT = 'checked_out';
    public const STATUS_ABSENT = 'absent';
    public const STATUS_LEAVE = 'leave';

    protected $fillable = [
        'organization_id',
        'branch_id',
        'employee_id',
        'shift_id',
        'work_date',
        'check_in_at',
        'check_out_at',
        'break_minutes',
        'total_minutes',
        'status',
        'location_label',
        'check_in_latitude',
        'check_in_longitude',
        'check_out_latitude',
        'check_out_longitude',
        'device',
        'note',
        'created_by',
        'leave_request_id',
        'leave_type',
    ];

    protected function casts(): array
    {
        return [
            'work_date' => 'date',
            'check_in_at' => 'datetime',
            'check_out_at' => 'datetime',
            'break_minutes' => 'integer',
            'total_minutes' => 'integer',
            'check_in_latitude' => 'float',
            'check_in_longitude' => 'float',
            'check_out_latitude' => 'float',
            'check_out_longitude' => 'float',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function shift(): BelongsTo
    {
        return $this->belongsTo(Shift::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function adjustments(): HasMany
    {
        return $this->hasMany(AttendanceAdjustment::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function leaveRequest(): BelongsTo
    {
        return $this->belongsTo(LeaveRequest::class);
    }

    public function isLeave(): bool
    {
        return $this->status === self::STATUS_LEAVE;
    }

    public function isPaidLeave(): bool
    {
        return $this->isLeave() && $this->leave_type !== LeaveRequest::TYPE_UNPAID;
    }
}
