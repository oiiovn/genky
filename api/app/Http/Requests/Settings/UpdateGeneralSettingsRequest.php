<?php

namespace App\Http\Requests\Settings;

use App\Services\Settings\GeneralSettingsService;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateGeneralSettingsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'work_hours_per_day' => ['required', 'integer', 'min:4', 'max:12'],
            'week_start' => ['required', 'string', Rule::in(GeneralSettingsService::WEEK_STARTS)],
            'date_format' => ['required', 'string', Rule::in(GeneralSettingsService::DATE_FORMATS)],
            'currency' => ['required', 'string', Rule::in(GeneralSettingsService::CURRENCIES)],
            'language' => ['required', 'string', Rule::in(GeneralSettingsService::LANGUAGES)],
        ];
    }

    public function messages(): array
    {
        return [
            'work_hours_per_day.required' => 'Giờ làm việc tiêu chuẩn là bắt buộc.',
            'work_hours_per_day.min' => 'Giờ làm việc tối thiểu là 4 giờ/ngày.',
            'work_hours_per_day.max' => 'Giờ làm việc tối đa là 12 giờ/ngày.',
            'week_start.in' => 'Ngày bắt đầu tuần không hợp lệ.',
            'date_format.in' => 'Định dạng ngày không hợp lệ.',
            'currency.in' => 'Đơn vị tiền tệ không hợp lệ.',
            'language.in' => 'Ngôn ngữ không hợp lệ.',
        ];
    }
}
