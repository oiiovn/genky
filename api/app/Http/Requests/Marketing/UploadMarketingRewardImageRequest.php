<?php

namespace App\Http\Requests\Marketing;

use Illuminate\Foundation\Http\FormRequest;

class UploadMarketingRewardImageRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'image' => ['required', 'file', 'image', 'max:8192', 'mimes:jpg,jpeg,png,webp'],
        ];
    }

    public function messages(): array
    {
        return [
            'image.required' => 'Vui lòng chọn ảnh món.',
            'image.image' => 'File phải là ảnh.',
            'image.max' => 'Ảnh tối đa 8MB.',
            'image.mimes' => 'Ảnh chỉ nhận JPG, PNG hoặc WEBP.',
        ];
    }
}
