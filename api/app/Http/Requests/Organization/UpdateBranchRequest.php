<?php

namespace App\Http\Requests\Organization;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBranchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'max:191'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['sometimes', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'check_in_radius_meters' => ['nullable', 'integer', 'min:20', 'max:5000'],
            'is_active' => ['sometimes', 'boolean'],
            'is_headquarters' => ['sometimes', 'boolean'],
        ];
    }
}
