<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateUserPreferencesRequest;
use App\Services\Settings\UserPreferencesService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UserPreferencesController extends Controller
{
    public function __construct(private readonly UserPreferencesService $preferences)
    {
    }

    public function show(Request $request): JsonResponse
    {
        return response()->json([
            'preferences' => $this->preferences->show($request->user()),
        ]);
    }

    public function update(UpdateUserPreferencesRequest $request): JsonResponse
    {
        return response()->json([
            'preferences' => $this->preferences->update($request->user(), $request->validated()),
        ]);
    }

    public function toggleSidebar(Request $request): JsonResponse
    {
        return response()->json([
            'preferences' => $this->preferences->toggleSidebar($request->user()),
        ]);
    }
}
