<?php

namespace App\Http\Requests\Leave;

use App\Models\LeaveRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreLeaveRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'type' => ['required', 'string', Rule::in(LeaveRequest::TYPES)],
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
            'reason' => ['required', 'string', 'max:500'],
            'employee_id' => ['nullable', 'integer'],
        ];
    }
}
