<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\UploadAvatarRequest;
use App\Services\Auth\AccountSecurityService;
use App\Services\Auth\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AccountSecurityController extends Controller
{
    public function __construct(
        private readonly AccountSecurityService $security,
        private readonly AuthService $auth,
    ) {
    }

    public function sessions(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->security->sessions($request->user()),
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        return response()->json(
            $this->security->history(
                $request->user(),
                (int) $request->integer('limit', 10),
            )
        );
    }

    public function uploadAvatar(UploadAvatarRequest $request): JsonResponse
    {
        $user = $this->security->updateAvatar($request->user(), $request->file('avatar'));

        return response()->json([
            'user' => $this->auth->userPayload($user),
        ]);
    }

    public function avatar(Request $request)
    {
        return $this->security->avatarFile($request->user());
    }
}
