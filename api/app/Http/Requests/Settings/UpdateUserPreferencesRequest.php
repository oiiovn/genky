<?php

namespace App\Http\Requests\Settings;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUserPreferencesRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'sidebar_style' => ['required', 'string', Rule::in(['expanded', 'collapsed'])],
        ];
    }

    public function messages(): array
    {
        return [
            'sidebar_style.required' => 'Kiểu sidebar là bắt buộc.',
            'sidebar_style.in' => 'Kiểu sidebar không hợp lệ.',
        ];
    }
}
