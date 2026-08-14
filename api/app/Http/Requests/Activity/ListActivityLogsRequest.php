<?php

namespace App\Http\Requests\Activity;

use App\Models\ActivityLog;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class ListActivityLogsRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'search' => ['nullable', 'string', 'max:191'],
            'user_id' => ['nullable', 'integer', 'min:1'],
            'action' => ['nullable', Rule::in([
                ActivityLog::ACTION_CREATE,
                ActivityLog::ACTION_UPDATE,
                ActivityLog::ACTION_DELETE,
                ActivityLog::ACTION_LOGIN,
                ActivityLog::ACTION_LOGOUT,
            ])],
            'result' => ['nullable', Rule::in([
                ActivityLog::RESULT_SUCCESS,
                ActivityLog::RESULT_FAIL,
            ])],
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:50'],
        ];
    }
}
