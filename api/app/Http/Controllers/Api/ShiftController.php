<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Shift\ImportShiftsRequest;
use App\Http\Requests\Shift\StoreShiftRequest;
use App\Http\Requests\Shift\UpdateShiftRequest;
use App\Services\Shift\ShiftService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ShiftController extends Controller
{
    public function __construct(private readonly ShiftService $shifts)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $paginator = $this->shifts->list($request->only([
            'branch_id',
            'status',
            'search',
            'per_page',
        ]));

        $date = $request->query('date');

        return response()->json([
            'data' => collect($paginator->items())->map(
                fn ($shift) => $this->shifts->payload($shift, is_string($date) ? $date : null)
            )->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function summary(Request $request): JsonResponse
    {
        $branchId = $request->query('branch_id');

        return response()->json([
            'data' => $this->shifts->summary($branchId ? (int) $branchId : null),
        ]);
    }

    public function store(StoreShiftRequest $request): JsonResponse
    {
        $shift = $this->shifts->create($request->validated());

        return response()->json([
            'data' => $this->shifts->payload($shift),
        ], 201);
    }

    public function show(Request $request, int $shift): JsonResponse
    {
        $model = $this->shifts->findOrFail($shift);
        $date = $request->query('date');

        return response()->json([
            'data' => $this->shifts->payload($model, is_string($date) ? $date : null),
        ]);
    }

    public function update(UpdateShiftRequest $request, int $shift): JsonResponse
    {
        $model = $this->shifts->findOrFail($shift);
        $updated = $this->shifts->update($model, $request->validated());

        return response()->json([
            'data' => $this->shifts->payload($updated),
        ]);
    }

    public function destroy(int $shift): JsonResponse
    {
        $model = $this->shifts->findOrFail($shift);
        $this->shifts->delete($model);

        return response()->json(['message' => 'Đã xoá ca làm.']);
    }

    public function import(ImportShiftsRequest $request): JsonResponse
    {
        $result = $this->shifts->import(
            $request->file('file'),
            $request->validated('branch_id') ? (int) $request->validated('branch_id') : null
        );

        return response()->json($result);
    }

    public function export(Request $request): StreamedResponse
    {
        $branchId = $request->query('branch_id');

        return $this->shifts->export($branchId ? (int) $branchId : null);
    }
}
