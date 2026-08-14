<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\UpdateInterfaceSettingsRequest;
use App\Services\Settings\InterfaceSettingsService;
use Illuminate\Http\JsonResponse;

class InterfaceSettingsController extends Controller
{
    public function __construct(private readonly InterfaceSettingsService $interface)
    {
    }

    public function show(): JsonResponse
    {
        return response()->json([
            'interface' => $this->interface->show(),
        ]);
    }

    public function update(UpdateInterfaceSettingsRequest $request): JsonResponse
    {
        return response()->json([
            'interface' => $this->interface->update($request->validated()),
        ]);
    }

    public function reset(): JsonResponse
    {
        return response()->json([
            'interface' => $this->interface->reset(),
        ]);
    }
}
