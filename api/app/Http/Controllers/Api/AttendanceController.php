<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Attendance\BulkAttendanceRequest;
use App\Http\Requests\Attendance\CheckInRequest;
use App\Http\Requests\Attendance\CheckOutRequest;
use App\Http\Requests\Attendance\DeleteSyntheticAttendanceRequest;
use App\Http\Requests\Attendance\UpdateAttendanceRequest;
use App\Services\Attendance\AttendanceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttendanceController extends Controller
{
    public function __construct(private readonly AttendanceService $attendance)
    {
    }

    public function overview(Request $request): JsonResponse
    {
        $date = $request->query('date', now()->toDateString());
        $branchId = $request->query('branch_id');

        return response()->json([
            'data' => $this->attendance->overview(
                (string) $date,
                $branchId ? (int) $branchId : null
            ),
        ]);
    }

    public function dashboard(Request $request): JsonResponse
    {
        $date = $request->query('date', now()->toDateString());
        $branchId = $request->query('branch_id');

        return response()->json([
            'data' => $this->attendance->dashboard(
                (string) $date,
                $branchId ? (int) $branchId : null
            ),
        ]);
    }

    public function shiftsToday(Request $request): JsonResponse
    {
        $date = $request->query('date', now()->toDateString());
        $branchId = $request->query('branch_id');

        return response()->json([
            'data' => $this->attendance->shiftsToday(
                (string) $date,
                $branchId ? (int) $branchId : null
            ),
        ]);
    }

    public function mine(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->attendance->mine($request->only([
                'date',
                'from',
                'to',
            ]))->values(),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $paginator = $this->attendance->list($request->only([
            'date',
            'from',
            'to',
            'branch_id',
            'shift_id',
            'status',
            'search',
            'page',
            'per_page',
        ]));

        return response()->json([
            'data' => collect($paginator->items())->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function show(int $attendance): JsonResponse
    {
        $log = $this->attendance->findOrFail($attendance);

        return response()->json([
            'data' => $this->attendance->payload($log),
        ]);
    }

    public function checkIn(CheckInRequest $request): JsonResponse
    {
        $log = $this->attendance->checkIn($request->validated());

        return response()->json([
            'data' => $this->attendance->payload($log),
        ], 201);
    }

    public function checkOut(CheckOutRequest $request): JsonResponse
    {
        $log = $this->attendance->checkOut($request->validated());

        return response()->json([
            'data' => $this->attendance->payload($log),
        ]);
    }

    public function update(UpdateAttendanceRequest $request, int $attendance): JsonResponse
    {
        $log = $this->attendance->findOrFail($attendance);
        $updated = $this->attendance->update($log, $request->validated());

        return response()->json([
            'data' => $this->attendance->payload($updated),
        ]);
    }

    public function destroy(int $attendance): JsonResponse
    {
        $log = $this->attendance->findOrFail($attendance);
        $this->attendance->delete($log);

        return response()->json(['message' => 'Đã xoá bản ghi chấm công.']);
    }

    public function destroySynthetic(DeleteSyntheticAttendanceRequest $request): JsonResponse
    {
        $this->attendance->deleteSynthetic(
            (int) $request->validated('employee_id'),
            (string) $request->validated('work_date'),
            (int) $request->validated('branch_id')
        );

        return response()->json(['message' => 'Đã xoá dòng chấm công tự sinh.']);
    }

    public function bulk(BulkAttendanceRequest $request): JsonResponse
    {
        return response()->json(
            $this->attendance->bulk($request->validated('items'))
        );
    }

    public function adjustments(int $attendance): JsonResponse
    {
        $log = $this->attendance->findOrFail($attendance);
        $rows = $this->attendance->adjustments($log);

        return response()->json([
            'data' => $rows->map(fn ($row) => [
                'id' => $row->id,
                'field' => $row->field,
                'old_value' => $row->old_value,
                'new_value' => $row->new_value,
                'reason' => $row->reason,
                'adjusted_by' => $row->adjuster?->name,
                'created_at' => $row->created_at?->toIso8601String(),
            ])->values(),
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        $date = (string) $request->query('date', now()->toDateString());
        $branchId = $request->query('branch_id');

        return $this->attendance->export(
            $date,
            $branchId ? (int) $branchId : null
        );
    }
}
