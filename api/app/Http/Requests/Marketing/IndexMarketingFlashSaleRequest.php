<?php

namespace App\Http\Requests\Marketing;

use App\Models\MarketingFlashSale;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class IndexMarketingFlashSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['nullable', 'string', Rule::in([
                'all',
                MarketingFlashSale::STATUS_RUNNING,
                MarketingFlashSale::STATUS_UPCOMING,
                MarketingFlashSale::STATUS_ENDED,
            ])],
            'branch_id' => ['nullable', 'integer'],
            'month' => ['nullable', 'string', 'regex:/^\d{4}-\d{2}$/'],
            'search' => ['nullable', 'string', 'max:200'],
        ];
    }
}
