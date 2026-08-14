<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LeaveRequest extends Model
{
    use BelongsToOrganization;

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_CANCELLED = 'cancelled';

    public const TYPE_ANNUAL = 'annual';
    public const TYPE_UNPAID = 'unpaid';
    public const TYPE_SICK = 'sick';
    public const TYPE_PERSONAL = 'personal';

    public const TYPES = [
        self::TYPE_ANNUAL,
        self::TYPE_UNPAID,
        self::TYPE_SICK,
        self::TYPE_PERSONAL,
    ];

    public const TYPE_LABELS = [
        self::TYPE_ANNUAL => 'Nghỉ phép năm',
        self::TYPE_UNPAID => 'Nghỉ không lương',
        self::TYPE_SICK => 'Nghỉ ốm',
        self::TYPE_PERSONAL => 'Việc riêng',
    ];

    protected $fillable = [
        'organization_id',
        'employee_id',
        'type',
        'starts_on',
        'ends_on',
        'days',
        'reason',
        'status',
        'reviewed_by',
        'reviewed_at',
        'review_note',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'date',
            'ends_on' => 'date',
            'days' => 'integer',
            'reviewed_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function attendanceLogs(): HasMany
    {
        return $this->hasMany(AttendanceLog::class);
    }

    public function isPaid(): bool
    {
        return $this->type !== self::TYPE_UNPAID;
    }
}
