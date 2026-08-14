<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceQrSetting extends Model
{
    use BelongsToOrganization;

    protected $fillable = [
        'organization_id',
        'branch_id',
        'enabled',
        'rotate_seconds',
        'valid_from',
        'valid_to',
        'allow_check_in',
        'allow_check_out',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'rotate_seconds' => 'integer',
            'allow_check_in' => 'boolean',
            'allow_check_out' => 'boolean',
        ];
    }

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }
}
