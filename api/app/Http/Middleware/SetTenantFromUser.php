<?php

namespace App\Http\Middleware;

use App\Support\Tenancy\TenantContext;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SetTenantFromUser
{
    public function handle(Request $request, Closure $next): Response
    {
        TenantContext::clear();

        $user = $request->user();

        if ($user) {
            $user->refresh();
            $user->loadMissing('currentOrganization');
            TenantContext::fromUser($user);
        }

        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        TenantContext::clear();
    }
}
