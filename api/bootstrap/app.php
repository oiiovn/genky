<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'feature' => \App\Http\Middleware\EnsureFeature::class,
            'tenant' => \App\Http\Middleware\SetTenantFromUser::class,
        ]);

        $middleware->redirectGuestsTo(function ($request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return null;
            }

            return 'https://genky.vn/login';
        });
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(function ($request, \Throwable $e) {
            return $request->is('api/*') || $request->expectsJson();
        });

        $exceptions->render(function (\App\Services\Feature\FeatureNotEnabledException $e) {
            return $e->render();
        });

        $exceptions->render(function (\App\Services\Marketing\CampaignNotReadyException $e) {
            return $e->render();
        });
    })->create();
