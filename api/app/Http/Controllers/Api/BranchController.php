<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Organization\StoreBranchRequest;
use App\Http\Requests\Organization\UpdateBranchRequest;
use App\Services\Organization\BranchService;
use Illuminate\Http\JsonResponse;

class BranchController extends Controller
{
    public function __construct(private readonly BranchService $branches)
    {
    }

    public function index(): JsonResponse
    {
        $items = $this->branches->list()->map(
            fn ($branch) => $this->branches->payload($branch)
        );

        return response()->json(['data' => $items]);
    }

    public function store(StoreBranchRequest $request): JsonResponse
    {
        $branch = $this->branches->create($request->validated());

        return response()->json([
            'branch' => $this->branches->payload($branch),
            'next_step' => 'dashboard',
        ], 201);
    }

    public function show(int $branch): JsonResponse
    {
        $model = $this->branches->findOrFail($branch);

        return response()->json([
            'branch' => $this->branches->payload($model),
        ]);
    }

    public function update(UpdateBranchRequest $request, int $branch): JsonResponse
    {
        $model = $this->branches->findOrFail($branch);
        $updated = $this->branches->update($model, $request->validated());

        return response()->json([
            'branch' => $this->branches->payload($updated),
        ]);
    }

    public function destroy(int $branch): JsonResponse
    {
        $model = $this->branches->findOrFail($branch);
        $this->branches->delete($model);

        return response()->json(['message' => 'Đã xoá chi nhánh.']);
    }
}
