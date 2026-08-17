<?php

namespace App\Http\Requests\Attendance;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ScanAttendanceQrRequest extends FormRequest
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
            'slot' => ['required', 'integer', 'min:0'],
            'token' => ['required', 'string', 'size:64'],
            'action' => ['nullable', Rule::in(['auto', 'check_in', 'check_out'])],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'device' => ['nullable', 'string', 'max:191'],
        ];
    }
}
