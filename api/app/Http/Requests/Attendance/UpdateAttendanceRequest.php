<?php

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAttendanceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'check_in_at' => ['nullable', 'date'],
            'check_out_at' => ['nullable', 'date'],
            'break_minutes' => ['nullable', 'integer', 'min:0', 'max:480'],
            'location_label' => ['nullable', 'string', 'max:191'],
            'note' => ['nullable', 'string', 'max:500'],
            'shift_id' => ['nullable', 'integer', 'exists:shifts,id'],
            'status' => ['nullable', Rule::in(['working', 'checked_out', 'absent', 'leave'])],
            'reason' => ['nullable', 'string', 'max:500'],
        ];
    }
}
