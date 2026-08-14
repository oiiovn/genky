<?php

namespace App\Http\Requests\Adjustment;

use App\Models\EmployeeAdjustment;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreAdjustmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'integer'],
            'type' => ['required', 'string', Rule::in(EmployeeAdjustment::TYPES)],
            'category' => ['required', 'string', Rule::in(EmployeeAdjustment::CATEGORIES)],
            'reason' => ['required', 'string', 'max:500'],
            'amount' => ['required', 'integer', 'min:0'],
            'date' => ['required', 'date'],
        ];
    }
}
