<?php

namespace App\Http\Middleware;

use App\Services\Activity\ActivityLogService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class LogActivity
{
    public function handle(Request $request, Closure $next): Response
    {
        try {
            $response = $next($request);
        } catch (Throwable $e) {
            app(ActivityLogService::class)->recordFromException($request, $e);

            throw $e;
        }

        app(ActivityLogService::class)->recordFromRequest($request, $response);

        return $response;
    }
}
