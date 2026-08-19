<?php

namespace App\Http\Requests\Marketing;

use App\Models\MarketingFlashSale;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreMarketingFlashSaleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'title' => ['required', 'string', 'max:200'],
            'branch_id' => ['nullable', 'integer'],
            'banner' => ['nullable', 'string', Rule::in(MarketingFlashSale::BANNERS)],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'slots' => ['nullable', 'array', 'max:12'],
            'slots.*' => ['string', 'max:32'],
            'quota' => ['nullable', 'integer', 'min:0', 'max:10000000'],
            'sold_count' => ['nullable', 'integer', 'min:0', 'max:10000000'],
            'revenue' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'products' => ['nullable', 'array', 'max:80'],
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

    public function messages(): array
    {
        return [
            'title.required' => 'Nhập tên chương trình.',
            'starts_at.required' => 'Chọn thời điểm bắt đầu.',
            'ends_at.required' => 'Chọn thời điểm kết thúc.',
            'ends_at.after' => 'Thời điểm kết thúc phải sau lúc bắt đầu.',
            'products.*.name.required' => 'Mỗi món cần có tên.',
        ];
    }
}
