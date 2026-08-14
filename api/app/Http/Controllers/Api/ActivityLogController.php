<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Activity\ListActivityLogsRequest;
use App\Services\Activity\ActivityLogService;
use Illuminate\Http\JsonResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ActivityLogController extends Controller
{
    public function __construct(private readonly ActivityLogService $logs)
    {
    }

    public function index(ListActivityLogsRequest $request): JsonResponse
    {
        return response()->json($this->logs->list($request->validated()));
    }

    public function export(ListActivityLogsRequest $request): StreamedResponse
    {
        return $this->logs->export($request->validated());
    }
}
