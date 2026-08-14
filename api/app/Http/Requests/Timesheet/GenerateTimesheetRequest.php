<?php

namespace App\Http\Requests\Timesheet;

use Illuminate\Foundation\Http\FormRequest;

class GenerateTimesheetRequest extends FormRequest
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
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ];
    }
}
