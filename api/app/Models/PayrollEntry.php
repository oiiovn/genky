<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollEntry extends Model
{
    use BelongsToOrganization;

    public const STATUS_DRAFT = 'draft';
    public const STATUS_PENDING = 'pending';
    public const STATUS_PARTIAL = 'partial';
    public const STATUS_PAID = 'paid';

    protected $fillable = [
        'organization_id',
        'employee_id',
        'year',
        'month',
        'status',
        'total_minutes',
        'income',
        'deductions',
        'net',
        'paid_amount',
        'paid_by',
        'paid_at',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'month' => 'integer',
            'total_minutes' => 'integer',
            'income' => 'integer',
            'deductions' => 'integer',
            'net' => 'integer',
            'paid_amount' => 'integer',
            'paid_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }

    public function payments(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(PayrollPayment::class, 'payroll_entry_id');
    }
}
