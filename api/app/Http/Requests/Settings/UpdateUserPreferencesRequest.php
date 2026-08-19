<?php

namespace App\Http\Requests\Settings;

use App\Services\Settings\UserPreferencesService;
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
            'sidebar_style' => [
                'required_without:payroll_table_columns',
                'nullable',
                'string',
                Rule::in(['expanded', 'collapsed']),
            ],
            'payroll_table_columns' => [
                'required_without:sidebar_style',
                'array',
                'min:1',
            ],
            'payroll_table_columns.*' => [
                'string',
                Rule::in(UserPreferencesService::PAYROLL_TABLE_COLUMNS),
            ],
        ];
    }

    public function messages(): array
    {
        return [
            'sidebar_style.in' => 'Kiểu sidebar không hợp lệ.',
            'payroll_table_columns.required_without' => 'Chọn cột hiển thị hoặc kiểu sidebar.',
            'payroll_table_columns.*.in' => 'Cột bảng lương không hợp lệ.',
        ];
    }
}
