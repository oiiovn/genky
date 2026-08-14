<?php

namespace App\Http\Requests\Attendance;

use App\Services\Attendance\AttendanceQrService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateAttendanceQrSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'branch_id' => ['required', 'integer', 'exists:branches,id'],
            'enabled' => ['sometimes', 'boolean'],
            'rotate_seconds' => ['required', 'integer', Rule::in(AttendanceQrService::ROTATE_OPTIONS)],
            'valid_from' => ['required', 'string', 'regex:/^\d{2}:\d{2}$/'],
            'valid_to' => ['required', 'string', 'regex:/^\d{2}:\d{2}$/'],
            'allow_check_in' => ['required', 'boolean'],
            'allow_check_out' => ['required', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'branch_id.required' => 'Vui lòng chọn chi nhánh.',
            'rotate_seconds.in' => 'Thời gian đổi QR không hợp lệ.',
            'valid_from.regex' => 'Khung giờ bắt đầu không hợp lệ.',
            'valid_to.regex' => 'Khung giờ kết thúc không hợp lệ.',
        ];
    }
}
