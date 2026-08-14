<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\ScanAttendanceQrRequest;
use App\Http\Requests\Attendance\UpdateAttendanceQrSettingsRequest;
use App\Services\Attendance\AttendanceQrService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AttendanceQrController extends Controller
{
    public function __construct(private readonly AttendanceQrService $qr)
    {
    }

    public function settings(Request $request): JsonResponse
    {
        $branchId = $request->filled('branch_id') ? (int) $request->integer('branch_id') : null;

        return response()->json([
            'data' => $this->qr->settings($branchId),
        ]);
    }

    public function updateSettings(UpdateAttendanceQrSettingsRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->qr->update($request->validated()),
        ]);
    }

    public function current(Request $request): JsonResponse
    {
        $branchId = $request->filled('branch_id') ? (int) $request->integer('branch_id') : null;

        return response()->json([
            'data' => $this->qr->current($branchId),
        ]);
    }

    public function recent(Request $request): JsonResponse
    {
        $branchId = $request->filled('branch_id') ? (int) $request->integer('branch_id') : null;
        $limit = (int) $request->integer('limit', 8);

        return response()->json([
            'data' => $this->qr->recent($branchId, $limit),
        ]);
    }

    public function scan(ScanAttendanceQrRequest $request): JsonResponse
    {
        $result = $this->qr->scan($request->validated());

        return response()->json($result, $result['action'] === 'check_in' ? 201 : 200);
    }
}
