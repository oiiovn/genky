<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PayrollPayment extends Model
{
    use BelongsToOrganization;

    public const METHOD_CASH = 'cash';
    public const METHOD_BANK = 'bank';
    public const METHOD_TRANSFER = 'transfer';
    public const METHOD_OTHER = 'other';

    protected $fillable = [
        'organization_id',
        'payroll_entry_id',
        'employee_id',
        'year',
        'month',
        'amount',
        'method',
        'content',
        'paid_by',
        'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'year' => 'integer',
            'month' => 'integer',
            'amount' => 'integer',
            'paid_at' => 'datetime',
        ];
    }

    public function entry(): BelongsTo
    {
        return $this->belongsTo(PayrollEntry::class, 'payroll_entry_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class);
    }

    public function payer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'paid_by');
    }
}
