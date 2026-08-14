<?php

namespace App\Http\Controllers\Api\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RefreshTokenRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Requests\Auth\UpdateProfileRequest;
use App\Services\Auth\AuthService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuthController extends Controller
{
    public function __construct(private readonly AuthService $auth)
    {
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        $payload = $this->auth->register($request->validated());

        return response()->json($payload, 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $payload = $this->auth->login(
            $request->string('login')->toString(),
            $request->string('password')->toString(),
        );

        return response()->json($payload);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->auth->logout(
            $request->user(),
            $request->input('refresh_token')
        );

        return response()->json(['message' => 'Đã đăng xuất.']);
    }

    public function refresh(RefreshTokenRequest $request): JsonResponse
    {
        $payload = $this->auth->refresh($request->string('refresh_token')->toString());

        return response()->json($payload);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($this->auth->me($request->user()));
    }

    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $this->auth->updateProfile($request->user(), $request->validated());

        return response()->json([
            'user' => $this->auth->userPayload($user),
        ]);
    }

    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $this->auth->changePassword(
            $request->user(),
            $request->string('current_password')->toString(),
            $request->string('password')->toString(),
        );

        return response()->json(['message' => 'Đã đổi mật khẩu.']);
    }

    public function logoutOthers(Request $request): JsonResponse
    {
        $this->auth->logoutOthers(
            $request->user(),
            $request->input('refresh_token')
        );

        return response()->json(['message' => 'Đã đăng xuất các thiết bị khác.']);
    }

    public function logoutAll(Request $request): JsonResponse
    {
        $this->auth->logoutAll($request->user());

        return response()->json(['message' => 'Đã đăng xuất tất cả thiết bị.']);
    }
}
