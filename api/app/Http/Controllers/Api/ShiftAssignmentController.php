<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Shift\BulkShiftAssignmentRequest;
use App\Http\Requests\Shift\CopyWeekShiftAssignmentRequest;
use App\Http\Requests\Shift\StoreShiftAssignmentRequest;
use App\Services\Shift\ShiftAssignmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ShiftAssignmentController extends Controller
{
    public function __construct(private readonly ShiftAssignmentService $assignments)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $rows = $this->assignments->list($request->only([
            'branch_id',
            'shift_id',
            'employee_id',
            'date_from',
            'date_to',
            'status',
        ]));

        return response()->json([
            'data' => $rows->map(fn ($row) => $this->assignments->payload($row))->values(),
        ]);
    }

    public function store(StoreShiftAssignmentRequest $request): JsonResponse
    {
        $assignment = $this->assignments->assign($request->validated());

        return response()->json([
            'data' => $this->assignments->payload($assignment),
        ], 201);
    }

    public function bulk(BulkShiftAssignmentRequest $request): JsonResponse
    {
        $result = $this->assignments->bulkAssign($request->validated());

        return response()->json([
            'data' => $result,
        ]);
    }

    public function copyWeek(CopyWeekShiftAssignmentRequest $request): JsonResponse
    {
        $result = $this->assignments->copyWeek($request->validated());

        return response()->json([
            'data' => $result,
        ]);
    }

    public function destroy(int $assignment): JsonResponse
    {
        $model = $this->assignments->findOrFail($assignment);
        $this->assignments->unassign($model);

        return response()->json(['message' => 'Đã huỷ phân ca.']);
    }
}
