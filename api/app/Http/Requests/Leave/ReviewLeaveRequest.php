<?php

namespace App\Http\Requests\Leave;

use App\Models\LeaveRequest;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ReviewLeaveRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'status' => ['required', Rule::in([
                LeaveRequest::STATUS_APPROVED,
                LeaveRequest::STATUS_REJECTED,
            ])],
            'note' => ['nullable', 'string', 'max:500'],
        ];
    }
}
