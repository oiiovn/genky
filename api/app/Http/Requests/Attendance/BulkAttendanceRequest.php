<?php

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;

class BulkAttendanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'items' => ['required', 'array', 'min:1'],
            'items.*.action' => ['nullable', 'in:check_in,check_out'],
            'items.*.employee_id' => ['required', 'integer', 'exists:employees,id'],
            'items.*.branch_id' => ['required', 'integer', 'exists:branches,id'],
            'items.*.shift_id' => ['nullable', 'integer', 'exists:shifts,id'],
            'items.*.work_date' => ['nullable', 'date'],
            'items.*.location_label' => ['nullable', 'string', 'max:191'],
        ];
    }
}
