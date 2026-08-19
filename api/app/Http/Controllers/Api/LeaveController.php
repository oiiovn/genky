<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Leave\ReviewLeaveRequest;
use App\Http\Requests\Leave\StoreLeaveRequest;
use App\Models\LeaveRequest;
use App\Services\Leave\LeaveService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaveController extends Controller
{
    public function __construct(private readonly LeaveService $leaves)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json(
            $this->leaves->list([
                'status' => $request->string('status')->toString() ?: null,
                'type' => $request->string('type')->toString() ?: null,
                'search' => $request->string('search')->toString() ?: null,
                'from' => $request->string('from')->toString()
                    ?: $request->string('date_from')->toString()
                    ?: null,
                'to' => $request->string('to')->toString()
                    ?: $request->string('date_to')->toString()
                    ?: null,
            ])
        );
    }

    public function store(StoreLeaveRequest $request): JsonResponse
    {
        $payload = $this->leaves->create($request->validated());
        $auto = ($payload['status'] ?? '') === LeaveRequest::STATUS_APPROVED;

        return response()->json([
            'data' => $payload,
            'message' => $auto
                ? 'Đã tạo đơn nghỉ phép và duyệt.'
                : 'Đã gửi đơn nghỉ phép. Chủ quán sẽ nhận thông báo để duyệt.',
        ], 201);
    }

    public function cancel(int $leave): JsonResponse
    {
        $model = $this->leaves->findOrFail($leave);

        return response()->json([
            'data' => $this->leaves->cancel($model),
            'message' => 'Đã hủy đơn nghỉ phép.',
        ]);
    }

    public function review(ReviewLeaveRequest $request, int $leave): JsonResponse
    {
        $model = $this->leaves->findOrFail($leave);
        $data = $request->validated();
        $payload = $this->leaves->review(
            $model,
            $data['status'],
            $data['note'] ?? null,
        );

        return response()->json([
            'data' => $payload,
            'message' => $data['status'] === LeaveRequest::STATUS_APPROVED
                ? 'Đã duyệt đơn nghỉ phép.'
                : 'Đã từ chối đơn nghỉ phép.',
        ]);
    }

    public function update(StoreLeaveRequest $request, int $leave): JsonResponse
    {
        $model = $this->leaves->findOrFail($leave);

        return response()->json([
            'data' => $this->leaves->update($model, $request->validated()),
            'message' => 'Đã cập nhật đơn nghỉ phép.',
        ]);
    }

    public function destroy(int $leave): JsonResponse
    {
        $model = $this->leaves->findOrFail($leave);
        $this->leaves->delete($model);

        return response()->json([
            'message' => 'Đã xoá đơn nghỉ phép.',
        ]);
    }
}
