<?php

namespace App\Http\Requests\Shift;

use Illuminate\Foundation\Http\FormRequest;

class CopyWeekShiftAssignmentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'source_from' => ['required', 'date'],
            'source_to' => ['required', 'date', 'after_or_equal:source_from'],
            'target_from' => ['required', 'date', 'after_or_equal:today'],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ];
    }

    public function messages(): array
    {
        return [
            'target_from.after_or_equal' => 'Tuần đích phải bắt đầu từ hôm nay trở đi.',
        ];
    }
}
