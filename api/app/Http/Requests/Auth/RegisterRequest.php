<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        if ($this->has('email')) {
            $this->merge([
                'email' => mb_strtolower(trim((string) $this->input('email'))),
            ]);
        }

        if ($this->has('phone') && $this->input('phone')) {
            $this->merge([
                'phone' => preg_replace('/\s+/', '', trim((string) $this->input('phone'))),
            ]);
        }

        if ($this->has('name')) {
            $this->merge(['name' => trim((string) $this->input('name'))]);
        }

        if ($this->has('organization_name')) {
            $this->merge([
                'organization_name' => trim((string) $this->input('organization_name')),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:191', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:30', 'unique:users,phone'],
            'password' => ['required', 'confirmed', Password::defaults()],
            'organization_name' => ['required', 'string', 'max:191'],
        ];
    }

    public function messages(): array
    {
        return [
            'organization_name.required' => 'Tên tổ chức / cửa hàng là bắt buộc.',
            'email.unique' => 'Email đã được sử dụng.',
            'phone.unique' => 'Số điện thoại đã được sử dụng.',
        ];
    }
}
