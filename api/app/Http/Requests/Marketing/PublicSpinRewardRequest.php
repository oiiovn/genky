<?php

namespace App\Http\Requests\Marketing;

use Illuminate\Foundation\Http\FormRequest;

class PublicSpinRewardRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'org_id' => ['required', 'integer', 'min:1'],
            'order_code' => ['required', 'string', 'max:120'],
        ];
    }

    public function messages(): array
    {
        return [
            'org_id.required' => 'Thiếu cửa hàng.',
            'order_code.required' => 'Nhập mã đơn hàng.',
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'order_code' => trim((string) $this->input('order_code')),
        ]);
    }
}
