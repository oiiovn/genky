<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Adjustment\StoreAdjustmentRequest;
use App\Services\Adjustment\AdjustmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdjustmentController extends Controller
{
    public function __construct(private readonly AdjustmentService $adjustments)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json(
            $this->adjustments->list($request->only(['year', 'month']))
        );
    }

    public function store(StoreAdjustmentRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->adjustments->create($request->validated()),
            'message' => 'Đã thêm thưởng / phạt.',
        ], 201);
    }

    public function update(StoreAdjustmentRequest $request, int $adjustment): JsonResponse
    {
        $row = $this->adjustments->findOrFail($adjustment);

        return response()->json([
            'data' => $this->adjustments->update($row, $request->validated()),
            'message' => 'Đã cập nhật thưởng / phạt.',
        ]);
    }

    public function destroy(int $adjustment): JsonResponse
    {
        $row = $this->adjustments->findOrFail($adjustment);
        $this->adjustments->delete($row);

        return response()->json(['message' => 'Đã xoá bản ghi.']);
    }
}
