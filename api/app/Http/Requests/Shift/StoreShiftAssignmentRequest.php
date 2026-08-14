<?php

namespace App\Http\Requests\Shift;

use Illuminate\Foundation\Http\FormRequest;

class StoreShiftAssignmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'shift_id' => ['required', 'integer', 'exists:shifts,id'],
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'date' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }
}
