<?php

namespace App\Http\Requests\Organization;

use Illuminate\Foundation\Http\FormRequest;

class StoreOrganizationDocumentRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:10240', 'mimes:pdf,jpg,jpeg,png,doc,docx'],
            'name' => ['nullable', 'string', 'max:191'],
        ];
    }

    public function messages(): array
    {
        return [
            'file.required' => 'Vui lòng chọn tài liệu.',
            'file.max' => 'Tài liệu tối đa 10MB.',
            'file.mimes' => 'Chỉ nhận PDF, ảnh hoặc Word.',
        ];
    }
}
