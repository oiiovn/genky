<?php

namespace App\Http\Requests\Organization;

use Illuminate\Foundation\Http\FormRequest;

class UpdateOrganizationRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:191'],
            'phone' => ['required', 'string', 'max:30'],
            'address' => ['required', 'string', 'max:255'],
            'timezone' => ['sometimes', 'string', 'max:64'],
            'locale' => ['sometimes', 'string', 'max:16'],
            'tax_code' => ['nullable', 'string', 'max:32'],
            'company_type' => ['nullable', 'string', 'max:64'],
            'company_size' => ['nullable', 'string', 'max:64'],
            'email' => ['nullable', 'email', 'max:191'],
            'website' => ['nullable', 'string', 'max:191'],
            'fax' => ['nullable', 'string', 'max:30'],
            'hotline' => ['nullable', 'string', 'max:30'],
            'representative' => ['nullable', 'string', 'max:191'],
            'representative_title' => ['nullable', 'string', 'max:64'],
            'established_at' => ['nullable', 'date'],
            'industry' => ['nullable', 'string', 'max:64'],
            'intro' => ['nullable', 'string', 'max:5000'],
        ];
    }

    public function messages(): array
    {
        return [
            'name.required' => 'Tên công ty là bắt buộc.',
            'phone.required' => 'Số điện thoại là bắt buộc.',
            'address.required' => 'Địa chỉ là bắt buộc.',
            'email.email' => 'Email không hợp lệ.',
        ];
    }
}
