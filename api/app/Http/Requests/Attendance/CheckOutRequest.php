<?php

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

class CheckOutRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'employee_id' => ['required', 'integer', 'exists:employees,id'],
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'work_date' => ['nullable', 'date'],
            'check_out_time' => ['nullable', 'date_format:H:i'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'location_label' => ['nullable', 'string', 'max:191'],
            'break_minutes' => ['nullable', 'integer', 'min:0', 'max:480'],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }
}
