<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeBranch extends Model
{
    protected $table = 'employee_branches';

    protected $fillable = [
        'employee_id',
        'branch_id',
        'is_primary',
        'assigned_at',
    ];

    protected function casts(): array
    {
        return [
            'is_primary' => 'boolean',
            'assigned_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
