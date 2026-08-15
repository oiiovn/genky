<?php

namespace App\Http\Requests\Marketing;

use Illuminate\Foundation\Http\FormRequest;

class StoreMarketingReviewRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'campaign_id' => ['nullable', 'integer'],
            'paste' => ['nullable', 'string', 'max:20000'],
            'order_code' => ['nullable', 'string', 'max:120'],
            'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
            'reviewed_at' => ['nullable', 'date'],
            'channel_id' => ['required', 'integer'],
            'branch_id' => ['required', 'integer'],
            'customer_name' => ['nullable', 'string', 'max:160'],
            'customer_phone' => ['nullable', 'string', 'max:40'],
            'review_content' => ['nullable', 'string', 'max:5000'],
            'source' => ['nullable', 'string', 'max:64'],
            'source_reference' => ['nullable', 'string', 'max:255'],
        ];
    }

    public function withValidator($validator): void
    {
        $validator->after(function ($validator) {
            $hasOrder = filled($this->input('order_code'));
            $hasPaste = filled($this->input('paste'));
            if (! $hasOrder && ! $hasPaste) {
                $validator->errors()->add(
                    'paste',
                    'Hãy dán nội dung đánh giá hoặc nhập mã đơn.',
                );
            }
        });
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('order_code')) {
            $this->merge([
                'order_code' => trim((string) $this->input('order_code')),
            ]);
        }
    }
}
