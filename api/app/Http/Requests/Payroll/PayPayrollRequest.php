<?php

namespace App\Http\Requests\Payroll;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PayPayrollRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'year' => ['required', 'integer', 'min:2020', 'max:2100'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'amount' => ['required', 'integer', 'min:1'],
            'method' => ['required', Rule::in(['cash', 'bank', 'transfer', 'other'])],
            'content' => ['nullable', 'string', 'max:500'],
        ];
    }
}
