<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class UploadAvatarRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'avatar' => ['required', 'file', 'image', 'max:8192', 'mimes:jpg,jpeg,png,webp'],
        ];
    }

    public function messages(): array
    {
        return [
            'avatar.required' => 'Vui lòng chọn ảnh đại diện.',
            'avatar.image' => 'Ảnh đại diện phải là file ảnh.',
            'avatar.max' => 'Ảnh đại diện tối đa 8MB.',
            'avatar.mimes' => 'Ảnh đại diện chỉ nhận JPG, PNG hoặc WEBP.',
        ];
    }
}
