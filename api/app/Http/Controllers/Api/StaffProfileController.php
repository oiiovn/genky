<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Staff\StaffProfileService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StaffProfileController extends Controller
{
    public function __construct(private readonly StaffProfileService $profiles)
    {
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json($this->profiles->profile($request->user()));
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'full_name' => ['sometimes', 'string', 'max:191'],
            'phone' => ['nullable', 'string', 'max:30'],
            'gender' => ['nullable', Rule::in(['male', 'female', 'other'])],
            'date_of_birth' => ['nullable', 'date'],
            'address' => ['nullable', 'string', 'max:500'],
            'identity_number' => ['nullable', 'string', 'max:32'],
        ]);

        return response()->json($this->profiles->update($request->user(), $data));
    }
}
