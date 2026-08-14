<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceAdjustment extends Model
{
    use BelongsToOrganization;

    protected $fillable = [
        'organization_id',
        'attendance_log_id',
        'adjusted_by',
        'field',
        'old_value',
        'new_value',
        'reason',
    ];

    public function log(): BelongsTo
    {
        return $this->belongsTo(AttendanceLog::class, 'attendance_log_id');
    }

    public function adjuster(): BelongsTo
    {
        return $this->belongsTo(User::class, 'adjusted_by');
    }
}
