<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Feature extends Model
{
    public const EMPLOYEES = 'employees';
    public const ATTENDANCE = 'attendance';
    public const SHIFTS = 'shifts';
    public const TIMESHEET = 'timesheet';
    public const PAYROLL = 'payroll';
    public const LEAVE = 'leave';
    public const INVENTORY = 'inventory';
    public const POS = 'pos';
    public const ORDERS = 'orders';
    public const REPORTS = 'reports';
    public const AI_ASSISTANT = 'ai_assistant';

    protected $fillable = [
        'code',
        'name',
        'description',
        'module_group',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function plans(): BelongsToMany
    {
        return $this->belongsToMany(Plan::class, 'plan_features')
            ->withPivot('enabled')
            ->withTimestamps();
    }
}
