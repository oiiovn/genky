<?php

namespace App\Http\Requests\Marketing;

use Illuminate\Foundation\Http\FormRequest;

class PublicVerifyOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'campaign_token' => ['required', 'string', 'max:64'],
            'order_code' => ['required', 'string', 'max:120'],
        ];
    }

    protected function prepareForValidation(): void
    {
        $this->merge([
            'campaign_token' => trim((string) $this->input('campaign_token')),
            'order_code' => trim((string) $this->input('order_code')),
        ]);
    }
}
