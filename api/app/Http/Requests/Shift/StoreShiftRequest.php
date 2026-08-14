<?php

namespace App\Http\Requests\Shift;

use App\Support\Tenancy\TenantContext;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreShiftRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:120'],
            'code' => [
                'nullable',
                'string',
                'max:32',
                Rule::unique('shifts', 'code')->where(
                    fn ($query) => $query->where(
                        'organization_id',
                        TenantContext::id()
                    )
                ),
            ],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i'],
            'break_time' => ['nullable', 'integer', 'min:0', 'max:480'],
            'break_minutes' => ['nullable', 'integer', 'min:0', 'max:480'],
            'color' => ['nullable', 'string', 'max:16'],
            'icon' => ['nullable', 'string', 'max:32'],
            'description' => ['nullable', 'string', 'max:2000'],
            'capacity' => ['nullable', 'integer', 'min:0', 'max:500'],
            'status' => ['nullable', Rule::in(['active', 'inactive'])],
            'branch_id' => ['nullable', 'integer', 'exists:branches,id'],
        ];
    }

    protected function prepareForValidation(): void
    {
        if (is_string($this->input('code'))) {
            $this->merge(['code' => strtoupper(trim($this->input('code')))]);
        }
    }

    public function messages(): array
    {
        return [
            'code.unique' => 'Mã ca đã tồn tại trong tổ chức.',
        ];
    }
}
