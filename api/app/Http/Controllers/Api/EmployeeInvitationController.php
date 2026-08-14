<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Employee\AcceptInvitationRequest;
use App\Services\Employee\EmployeeService;
use Illuminate\Http\JsonResponse;

class EmployeeInvitationController extends Controller
{
    public function __construct(private readonly EmployeeService $employees)
    {
    }

    public function show(string $token): JsonResponse
    {
        $invitation = $this->employees->findInvitationByToken($token);

        return response()->json([
            'data' => $this->employees->invitationPreview($invitation),
        ]);
    }

    public function accept(AcceptInvitationRequest $request, string $token): JsonResponse
    {
        $session = $this->employees->acceptInvitation($token, $request->validated());

        return response()->json($session);
    }
}
