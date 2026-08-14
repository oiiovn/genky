<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        $login = $this->input('login', $this->input('email'));
        if ($login !== null) {
            $this->merge([
                'login' => trim((string) $login),
            ]);
        }
    }

    public function rules(): array
    {
        return [
            'login' => ['required', 'string', 'max:191'],
            'password' => ['required', 'string'],
        ];
    }

    public function messages(): array
    {
        return [
            'login.required' => 'Vui lòng nhập email hoặc số điện thoại.',
        ];
    }
}
