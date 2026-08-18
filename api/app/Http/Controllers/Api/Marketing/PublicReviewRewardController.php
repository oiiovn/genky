<?php

namespace App\Http\Controllers\Api\Marketing;

use App\Http\Controllers\Controller;
use App\Http\Requests\Marketing\PublicSpinRewardRequest;
use App\Http\Requests\Marketing\PublicVerifyOrderRequest;
use App\Models\MarketingQrCode;
use App\Services\Marketing\MarketingLandingAudioService;
use App\Services\Marketing\MarketingLandingStyleService;
use App\Services\Marketing\PublicReviewRewardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicReviewRewardController extends Controller
{
    public function __construct(
        private readonly PublicReviewRewardService $rewards,
        private readonly MarketingLandingAudioService $audio,
        private readonly MarketingLandingStyleService $style,
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

    public function spin(PublicSpinRewardRequest $request): JsonResponse
    {
        $payload = $this->rewards->spin(
            (int) $request->validated('org_id'),
            (string) $request->validated('order_code'),
        );

        return response()->json($payload);
    }

    public function claim(string $token): JsonResponse
    {
        $payload = $this->rewards->claim(trim($token));

        return response()->json($payload);
    }

    public function landing(Request $request): JsonResponse
    {
        $orgId = $this->resolveOrganizationId($request);

        return response()->json([
            'data' => $orgId > 0
                ? $this->style->showForOrganization($orgId)
                : ['style' => [], 'landing' => []],
        ]);
    }

    public function guideAudio(Request $request): JsonResponse
    {
        $orgId = $this->resolveOrganizationId($request);

        return response()->json([
            'data' => $orgId > 0
                ? $this->audio->showForOrganization($orgId)
                : ['audio_url' => null, 'file_name' => null],
        ]);
    }

    protected function resolveOrganizationId(Request $request): int
    {
        $orgId = (int) $request->query('org_id', 0);
        if ($orgId > 0) {
            return $orgId;
        }

        $token = trim((string) $request->query('token', ''));
        if ($token === '') {
            return 0;
        }

        $qr = MarketingQrCode::withoutGlobalScopes()
            ->where('token', $token)
            ->where('enabled', true)
            ->first();

        return $qr ? (int) $qr->organization_id : 0;
    }
}
