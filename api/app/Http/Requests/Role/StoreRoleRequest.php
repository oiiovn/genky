<?php

namespace App\Http\Requests\Role;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreRoleRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'icon' => ['nullable', 'string', Rule::in(['crown', 'shield', 'cash', 'user', 'box'])],
            'color' => ['nullable', 'string', 'max:64'],
            'bg' => ['nullable', 'string', 'max:64'],
            'permissions' => ['nullable', 'array'],
        ];
    }
}
