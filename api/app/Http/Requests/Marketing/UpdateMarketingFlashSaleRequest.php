<?php

namespace App\Http\Requests\Marketing;

use App\Models\MarketingFlashSale;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMarketingFlashSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['sometimes', 'required', 'string', 'max:200'],
            'branch_id' => ['sometimes', 'nullable', 'integer'],
            'banner' => ['sometimes', 'nullable', 'string', Rule::in(MarketingFlashSale::BANNERS)],
            'starts_at' => ['sometimes', 'required', 'date'],
            'ends_at' => ['sometimes', 'required', 'date'],
            'slots' => ['sometimes', 'nullable', 'array', 'max:12'],
            'slots.*' => ['string', 'max:32'],
            'quota' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:10000000'],
            'sold_count' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:10000000'],
            'revenue' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:100000000000'],
            'products' => ['sometimes', 'nullable', 'array', 'max:80'],
            'products.*.id' => ['nullable', 'integer'],
            'products.*.name' => ['required', 'string', 'max:160'],
            'products.*.emoji' => ['nullable', 'string', 'max:16'],
            'products.*.tone' => ['nullable', 'string', 'max:80'],
            'products.*.price' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'products.*.original_price' => ['nullable', 'integer', 'min:0', 'max:100000000'],
            'products.*.slot_start' => ['nullable', 'string', 'max:8'],
            'products.*.slot_end' => ['nullable', 'string', 'max:8'],
            'products.*.slot' => ['nullable', 'string', 'max:32'],
        ];
    }
}
