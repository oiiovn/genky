<?php

namespace App\Http\Requests\Employee;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEmployeeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'employee_code' => ['nullable', 'string', 'max:32'],
            'full_name' => ['required', 'string', 'max:191'],
            'phone' => ['nullable', 'string', 'max:30'],
            'email' => ['nullable', 'email', 'max:191'],
            'avatar' => ['nullable', 'string', 'max:255'],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'date_of_birth' => ['nullable', 'date'],
            'address' => ['nullable', 'string', 'max:255'],
            'position_id' => ['nullable', 'integer'],
            'role_id' => ['nullable', 'integer'],
            'employment_type' => ['nullable', Rule::in(['full_time', 'part_time', 'collaborator', 'intern'])],
            'salary_type' => ['nullable', Rule::in(['hourly', 'monthly', 'shift'])],
            'salary_amount' => ['nullable', 'integer', 'min:0'],
            'joined_at' => ['nullable', 'date'],
            'status' => ['nullable', Rule::in(['active', 'inactive', 'resigned'])],
            'branch_ids' => ['nullable', 'array'],
            'branch_ids.*' => ['integer'],
            'primary_branch_id' => ['nullable', 'integer'],
        ];
    }
}
