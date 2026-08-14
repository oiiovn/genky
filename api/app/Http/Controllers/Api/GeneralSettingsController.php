<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateGeneralSettingsRequest;
use App\Services\Settings\GeneralSettingsService;
use Illuminate\Http\JsonResponse;

class GeneralSettingsController extends Controller
{
    public function __construct(private readonly GeneralSettingsService $general)
    {
    }

    public function show(): JsonResponse
    {
        return response()->json($this->general->overview());
    }

    public function update(UpdateGeneralSettingsRequest $request): JsonResponse
    {
        return response()->json([
            'general' => $this->general->update($request->validated()),
        ]);
    }

    public function backup(): JsonResponse
    {
        return response()->json([
            'backup' => $this->general->backup(),
        ]);
    }
}
