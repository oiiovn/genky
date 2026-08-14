<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeAdjustment extends Model
{
    use BelongsToOrganization;

    public const TYPE_REWARD = 'reward';
    public const TYPE_PENALTY = 'penalty';

    public const TYPES = [
        self::TYPE_REWARD,
        self::TYPE_PENALTY,
    ];

    public const CATEGORY_PERSONAL_REWARD = 'personal_reward';
    public const CATEGORY_TEAM_REWARD = 'team_reward';
    public const CATEGORY_KPI_REWARD = 'kpi_reward';
    public const CATEGORY_DISCIPLINE = 'discipline';
    public const CATEGORY_LATE = 'late';
    public const CATEGORY_OTHER_PENALTY = 'other_penalty';

    public const CATEGORIES = [
        self::CATEGORY_PERSONAL_REWARD,
        self::CATEGORY_TEAM_REWARD,
        self::CATEGORY_KPI_REWARD,
        self::CATEGORY_DISCIPLINE,
        self::CATEGORY_LATE,
        self::CATEGORY_OTHER_PENALTY,
    ];

    public const REWARD_CATEGORIES = [
        self::CATEGORY_PERSONAL_REWARD,
        self::CATEGORY_TEAM_REWARD,
        self::CATEGORY_KPI_REWARD,
    ];

    public const PENALTY_CATEGORIES = [
        self::CATEGORY_DISCIPLINE,
        self::CATEGORY_LATE,
        self::CATEGORY_OTHER_PENALTY,
    ];

    protected $fillable = [
        'organization_id',
        'employee_id',
        'type',
        'category',
        'reason',
        'amount',
        'occurred_on',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'integer',
            'occurred_on' => 'date',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
