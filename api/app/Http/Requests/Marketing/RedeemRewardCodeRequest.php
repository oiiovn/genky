<?php

namespace App\Http\Requests\Marketing;

use Illuminate\Foundation\Http\FormRequest;

class RedeemRewardCodeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'branch_id' => ['required', 'integer'],
            'note' => ['nullable', 'string', 'max:1000'],
            'device_id' => ['nullable', 'string', 'max:120'],
        ];
    }
}
