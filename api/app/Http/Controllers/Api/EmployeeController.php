<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Employee\AssignBranchRequest;
use App\Http\Requests\Employee\InviteEmployeeRequest;
use App\Http\Requests\Employee\StoreEmployeeRequest;
use App\Http\Requests\Employee\UpdateEmployeeRequest;
use App\Services\Employee\EmployeeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class EmployeeController extends Controller
{
    public function __construct(private readonly EmployeeService $employees)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $paginator = $this->employees->list($request->only([
            'branch_id',
            'status',
            'position_id',
            'role_id',
            'search',
            'per_page',
        ]));

        return response()->json([
            'data' => collect($paginator->items())->map(
                fn ($employee) => $this->employees->payload($employee)
            )->values(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function store(StoreEmployeeRequest $request): JsonResponse
    {
        $employee = $this->employees->create($request->validated());

        return response()->json([
            'data' => $this->employees->payload($employee),
        ], 201);
    }

    public function show(int $employee): JsonResponse
    {
        $model = $this->employees->findOrFail($employee);

        return response()->json([
            'data' => $this->employees->payload($model),
        ]);
    }

    public function update(UpdateEmployeeRequest $request, int $employee): JsonResponse
    {
        $model = $this->employees->findOrFail($employee);
        $updated = $this->employees->update($model, $request->validated());

        return response()->json([
            'data' => $this->employees->payload($updated),
        ]);
    }

    public function destroy(int $employee): JsonResponse
    {
        $model = $this->employees->findOrFail($employee);
        $this->employees->delete($model);

        return response()->json(['message' => 'Đã xoá nhân viên.']);
    }

    public function assignBranch(AssignBranchRequest $request, int $employee): JsonResponse
    {
        $model = $this->employees->findOrFail($employee);
        $updated = $this->employees->assignBranch(
            $model,
            (int) $request->validated('branch_id'),
            (bool) $request->boolean('is_primary')
        );

        return response()->json([
            'data' => $this->employees->payload($updated),
        ]);
    }

    public function removeBranch(int $employee, int $branch): JsonResponse
    {
        $model = $this->employees->findOrFail($employee);
        $updated = $this->employees->removeBranch($model, $branch);

        return response()->json([
            'data' => $this->employees->payload($updated),
        ]);
    }

    public function invite(InviteEmployeeRequest $request, int $employee): JsonResponse
    {
        $model = $this->employees->findOrFail($employee);
        $invitation = $this->employees->invite(
            $model,
            $request->validated('email') ?? null
        );

        return response()->json([
            'data' => $this->employees->invitationPayload($invitation),
        ], 201);
    }
}
