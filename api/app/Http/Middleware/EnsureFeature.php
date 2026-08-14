<?php

namespace App\Http\Middleware;

use App\Services\Feature\FeatureEntitlementService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureFeature
{
    public function __construct(private readonly FeatureEntitlementService $features)
    {
    }

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string $featureCode): Response
    {
        $this->features->assertEnabled($featureCode);

        return $next($request);
    }
}
