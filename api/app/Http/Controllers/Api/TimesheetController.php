<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Timesheet\ApproveTimesheetRequest;
use App\Http\Requests\Timesheet\GenerateTimesheetRequest;
use App\Services\Timesheet\TimesheetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TimesheetController extends Controller
{
    public function __construct(private readonly TimesheetService $timesheets)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json(
            $this->timesheets->list($request->only([
                'year',
                'month',
                'branch_id',
                'department',
                'shift_id',
                'status',
                'search',
                'page',
                'per_page',
            ]))
        );
    }

    public function dashboard(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->timesheets->dashboard($request->only([
                'year',
                'month',
                'branch_id',
                'department',
                'shift_id',
                'status',
                'search',
            ])),
        ]);
    }

    public function generate(GenerateTimesheetRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->timesheets->generate($request->validated()),
            'message' => 'Đã tạo bảng công tháng.',
        ]);
    }

    public function approve(ApproveTimesheetRequest $request): JsonResponse
    {
        $result = $this->timesheets->approve($request->validated());

        return response()->json([
            'data' => $result,
            'message' => $result['status'] === 'approved'
                ? 'Đã duyệt bảng công.'
                : 'Đã bỏ duyệt bảng công.',
        ]);
    }

    public function export(Request $request): StreamedResponse
    {
        return $this->timesheets->export($request->only([
            'year',
            'month',
            'branch_id',
            'department',
            'shift_id',
            'status',
            'search',
        ]));
    }
}
