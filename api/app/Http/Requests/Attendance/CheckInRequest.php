<?php

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

class CheckInRequest extends FormRequest
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
            'shift_id' => ['nullable', 'integer', 'exists:shifts,id'],
            'work_date' => ['nullable', 'date'],
            'check_in_time' => ['nullable', 'date_format:H:i'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'location_label' => ['nullable', 'string', 'max:191'],
            'device' => ['nullable', 'string', 'max:191'],
        ];
    }
}
