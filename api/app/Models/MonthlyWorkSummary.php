<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MonthlyWorkSummary extends Model
{
    use BelongsToOrganization;

    protected $fillable = [
        'organization_id',
        'employee_id',
        'year',
        'month',
        'branch_id',
        'work_days',
        'work_minutes',
        'ot_minutes',
        'leave_days',
        'other_leave_days',
        'payroll_leave_days',
        'payroll_paid_leave_days',
        'payroll_unpaid_days',
        'payroll_worked_minutes',
        'payroll_paid_leave_minutes',
        'payroll_unpaid_leave_minutes',
        'payroll_assignment_minutes',
        'payroll_total_minutes',
        'shifts',
        'computed_at',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'month' => 'integer',
            'branch_id' => 'integer',
            'work_days' => 'integer',
            'work_minutes' => 'integer',
            'ot_minutes' => 'integer',
            'leave_days' => 'integer',
            'other_leave_days' => 'integer',
            'payroll_leave_days' => 'integer',
            'payroll_paid_leave_days' => 'integer',
            'payroll_unpaid_days' => 'integer',
            'payroll_worked_minutes' => 'integer',
            'payroll_paid_leave_minutes' => 'integer',
            'payroll_unpaid_leave_minutes' => 'integer',
            'payroll_assignment_minutes' => 'integer',
            'payroll_total_minutes' => 'integer',
            'shifts' => 'array',
            'computed_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }
}
