<?php

namespace App\Http\Requests\Organization;

use Illuminate\Foundation\Http\FormRequest;

class UploadOrganizationLogoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'logo' => ['required', 'file', 'image', 'max:8192', 'mimes:jpg,jpeg,png,webp'],
        ];
    }

    public function messages(): array
    {
        return [
            'logo.required' => 'Vui lòng chọn ảnh logo.',
            'logo.image' => 'Logo phải là file ảnh.',
            'logo.max' => 'Logo tối đa 8MB.',
            'logo.mimes' => 'Logo chỉ nhận JPG, PNG hoặc WEBP.',
        ];
    }
}
