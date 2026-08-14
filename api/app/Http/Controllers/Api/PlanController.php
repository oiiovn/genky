<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Billing\PlanCatalogService;
use Illuminate\Http\JsonResponse;

class PlanController extends Controller
{
    public function __construct(private readonly PlanCatalogService $catalog)
    {
    }

    public function index(): JsonResponse
    {
        return response()->json($this->catalog->catalog());
    }
}
