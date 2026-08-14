<?php

namespace App\Http\Requests\Settings;

use App\Services\Settings\InterfaceSettingsService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateInterfaceSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        foreach (['primary_color', 'secondary_color'] as $key) {
            if ($this->has($key)) {
                $this->merge([
                    $key => strtoupper(trim((string) $this->input($key))),
                ]);
            }
        }
    }

    public function rules(): array
    {
        return [
            'theme_preset' => ['required', 'string', Rule::in(InterfaceSettingsService::THEME_PRESETS)],
            'primary_color' => ['required', 'string', 'regex:/^#[0-9A-F]{6}$/'],
            'secondary_color' => ['required', 'string', 'regex:/^#[0-9A-F]{6}$/'],
            'display_mode' => ['required', 'string', Rule::in(['light', 'dark'])],
            'sidebar_style' => ['required', 'string', Rule::in(['expanded', 'collapsed'])],
            'rounded_corners' => ['required', 'boolean'],
            'animations_enabled' => ['required', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'theme_preset.required' => 'Vui lòng chọn chủ đề màu.',
            'theme_preset.in' => 'Chủ đề màu không hợp lệ.',
            'primary_color.required' => 'Màu chủ đạo là bắt buộc.',
            'primary_color.regex' => 'Màu chủ đạo phải là mã hex, ví dụ #6366F1.',
            'secondary_color.required' => 'Màu phụ là bắt buộc.',
            'secondary_color.regex' => 'Màu phụ phải là mã hex, ví dụ #EEF2FF.',
            'display_mode.in' => 'Chế độ hiển thị không hợp lệ.',
            'sidebar_style.in' => 'Kiểu sidebar không hợp lệ.',
        ];
    }
}
