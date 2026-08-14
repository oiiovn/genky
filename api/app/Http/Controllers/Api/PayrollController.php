<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Payroll\GeneratePayrollRequest;
use App\Http\Requests\Payroll\MarkPayrollPaidRequest;
use App\Http\Requests\Payroll\PayPayrollRequest;
use App\Services\Payroll\PayrollService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PayrollController extends Controller
{
    public function __construct(private readonly PayrollService $payroll)
    {
    }

    public function index(Request $request): JsonResponse
    {
        return response()->json(
            $this->payroll->list($request->only([
                'year',
                'month',
                'branch_id',
                'department',
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
            'data' => $this->payroll->dashboard($request->only([
                'year',
                'month',
                'branch_id',
                'department',
                'status',
                'search',
            ])),
        ]);
    }

    public function generate(GeneratePayrollRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->payroll->generate($request->validated()),
            'message' => 'Đã tạo bảng lương tháng.',
        ]);
    }

    public function markPaid(MarkPayrollPaidRequest $request): JsonResponse
    {
        $result = $this->payroll->markPaid($request->validated());

        return response()->json([
            'data' => $result,
            'message' => $result['status'] === 'paid'
                ? 'Đã đánh dấu thanh toán.'
                : 'Đã cập nhật trạng thái lương.',
        ]);
    }

    public function pay(PayPayrollRequest $request): JsonResponse
    {
        return response()->json([
            'data' => $this->payroll->pay($request->validated()),
            'message' => 'Đã thanh toán lương.',
        ]);
    }

    public function paymentHistory(Request $request): JsonResponse
    {
        return response()->json(
            $this->payroll->paymentHistory($request->only([
                'year',
                'month',
                'branch_id',
                'search',
                'page',
                'per_page',
            ]))
        );
    }

    public function history(Request $request): JsonResponse
    {
        return response()->json(
            $this->payroll->history($request->only([
                'year',
                'branch_id',
                'status',
                'search',
                'page',
                'per_page',
            ]))
        );
    }

    public function historyDetail(Request $request, int $year, int $month): JsonResponse
    {
        return response()->json(
            $this->payroll->historyDetail($year, $month, $request->only([
                'branch_id',
            ]))
        );
    }

    public function export(Request $request): StreamedResponse
    {
        return $this->payroll->export($request->only([
            'year',
            'month',
            'branch_id',
            'department',
            'status',
            'search',
        ]));
    }
}
