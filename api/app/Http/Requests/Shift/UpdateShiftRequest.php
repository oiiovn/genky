<?php

namespace App\Http\Requests\Shift;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:120'],
            'code' => ['sometimes', 'string', 'max:32'],
            'start_time' => ['sometimes', 'date_format:H:i'],
            'end_time' => ['sometimes', 'date_format:H:i'],
            'break_time' => ['nullable', 'integer', 'min:0', 'max:480'],
            'break_minutes' => ['nullable', 'integer', 'min:0', 'max:480'],
            'color' => ['nullable', 'string', 'max:16'],
            'icon' => ['nullable', 'string', 'max:32'],
            'description' => ['nullable', 'string', 'max:2000'],
            'capacity' => ['nullable', 'integer', 'min:0', 'max:500'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ];
    }
}
