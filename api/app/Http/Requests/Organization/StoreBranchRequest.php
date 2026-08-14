<?php

namespace App\Http\Requests\Organization;

use Illuminate\Foundation\Http\FormRequest;

class StoreBranchRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:191'],
            'phone' => ['nullable', 'string', 'max:30'],
            'address' => ['required', 'string', 'max:255'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'check_in_radius_meters' => ['nullable', 'integer', 'min:20', 'max:5000'],
            'is_headquarters' => ['sometimes', 'boolean'],
        ];
    }
}
