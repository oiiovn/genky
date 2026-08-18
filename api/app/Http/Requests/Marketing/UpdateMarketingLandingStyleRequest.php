<?php

namespace App\Http\Requests\Marketing;

use Illuminate\Foundation\Http\FormRequest;

class UpdateMarketingLandingStyleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'style' => ['nullable', 'array'],
            'style.primary' => ['nullable', 'string', 'max:32'],
            'style.secondary' => ['nullable', 'string', 'max:32'],
            'style.background' => ['nullable', 'string', 'max:32'],
            'style.text' => ['nullable', 'string', 'max:32'],
            'landing' => ['nullable', 'array'],
            'landing.shopeeFoodUrl' => ['nullable', 'string', 'max:2000'],
            'landing.grabFoodUrl' => ['nullable', 'string', 'max:2000'],
            'landing.buyNowUrl' => ['nullable', 'string', 'max:2000'],
            'landing.buttonRadius' => ['nullable', 'integer', 'min:8', 'max:28'],
        ];
    }
}
