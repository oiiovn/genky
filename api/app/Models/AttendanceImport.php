<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceImport extends Model
{
    use BelongsToOrganization;

    protected $fillable = [
        'organization_id',
        'branch_id',
        'import_type',
        'file_path',
        'total_rows',
        'success_rows',
        'error_rows',
        'imported_by',
    ];

    public function branch(): BelongsTo
    {
        return $this->belongsTo(Branch::class);
    }

    public function importer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'imported_by');
    }
}
