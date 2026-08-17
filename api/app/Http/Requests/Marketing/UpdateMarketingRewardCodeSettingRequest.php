<?php

namespace App\Http\Requests\Marketing;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMarketingRewardCodeSettingRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'prefix' => ['nullable', 'string', 'max:32'],
            'length' => ['nullable', 'integer', 'min:1', 'max:16'],
            'use_letters' => ['nullable', 'boolean'],
            'use_numbers' => ['nullable', 'boolean'],
            'exclude_zero' => ['nullable', 'boolean'],
            'exclude_o' => ['nullable', 'boolean'],
            'exclude_i' => ['nullable', 'boolean'],
            'exclude_one' => ['nullable', 'boolean'],
            'expiry_type' => ['nullable', 'string', 'max:32'],
            'expiry_days' => ['nullable', 'integer', 'min:1', 'max:3650'],
            'expiry_date' => ['nullable', 'date'],
            'reward_before_review' => ['nullable', 'boolean'],
        ];
    }
}
