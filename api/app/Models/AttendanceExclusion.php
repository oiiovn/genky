<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;

class AttendanceExclusion extends Model
{
    use BelongsToOrganization;

    protected $fillable = [
        'organization_id',
        'branch_id',
        'employee_id',
        'work_date',
        'deleted_by',
    ];

    protected function casts(): array
    {
        return [
            'work_date' => 'date',
        ];
    }
}
