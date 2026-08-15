<?php

namespace App\Http\Controllers\Api\Marketing;

use App\Http\Controllers\Controller;
use App\Http\Requests\Marketing\PublicVerifyOrderRequest;
use App\Services\Marketing\PublicReviewRewardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicReviewRewardController extends Controller
{
    public function __construct(
        private readonly PublicReviewRewardService $rewards,
    ) {
    }

    public function verifyOrder(PublicVerifyOrderRequest $request): JsonResponse
    {
        $payload = $this->rewards->verifyOrder(
            (string) $request->validated('campaign_token'),
            (string) $request->validated('order_code'),
            $request->ip(),
        );

        return response()->json($payload);
    }

    public function claim(string $token): JsonResponse
    {
        $payload = $this->rewards->claim(trim($token));

        return response()->json($payload);
    }
}
