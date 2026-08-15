<?php

namespace App\Support\Access;

use Closure;
use Illuminate\Support\Facades\Cache;

class AccessCache
{
    public const TTL_SECONDS = 600;

    /** @var array<string, mixed> */
    protected static array $request = [];

    public static function rememberRequest(string $key, Closure $callback): mixed
    {
        if (array_key_exists($key, self::$request)) {
            return self::$request[$key];
        }

        return self::$request[$key] = $callback();
    }

    public static function flushRequest(): void
    {
        self::$request = [];
    }

    /**
     * @template T
     * @param  Closure(): T  $callback
     * @return T
     */
    public static function rememberFeatures(int $organizationId, int $branchId, Closure $callback): mixed
    {
        $ver = self::version('feat', $organizationId);

        return Cache::remember(
            "access:feat:{$organizationId}:{$branchId}:{$ver}",
            self::TTL_SECONDS,
            $callback
        );
    }

    /**
     * @param  Closure(): array<string, mixed>  $callback
     * @return array<string, mixed>
     */
    public static function rememberFeatureSnapshot(int $organizationId, int $branchId, Closure $callback): array
    {
        $ver = self::version('feat', $organizationId);

        return Cache::remember(
            "access:featsnap:{$organizationId}:{$branchId}:{$ver}",
            self::TTL_SECONDS,
            $callback
        );
    }

    /**
     * @param  Closure(): array<string, mixed>  $callback
     * @return array<string, mixed>
     */
    public static function rememberPermission(int $userId, int $organizationId, Closure $callback): array
    {
        $ver = self::version('perm', $organizationId);

        return Cache::remember(
            "access:perm:{$userId}:{$organizationId}:{$ver}",
            self::TTL_SECONDS,
            $callback
        );
    }

    public static function rememberRole(int $userId, int $organizationId, Closure $callback): ?string
    {
        $ver = self::version('perm', $organizationId);
        $role = Cache::remember(
            "access:role:{$userId}:{$organizationId}:{$ver}",
            self::TTL_SECONDS,
            fn () => $callback() ?? '',
        );

        return $role === '' || $role === null ? null : (string) $role;
    }

    public static function bumpFeatures(int $organizationId): void
    {
        self::bump('feat', $organizationId);
        self::flushRequest();
    }

    public static function bumpPermissions(int $organizationId): void
    {
        self::bump('perm', $organizationId);
        self::flushRequest();
    }

    protected static function version(string $kind, int $organizationId): int
    {
        return (int) Cache::get("access:{$kind}:ver:{$organizationId}", 1);
    }

    protected static function bump(string $kind, int $organizationId): void
    {
        $key = "access:{$kind}:ver:{$organizationId}";
        Cache::forever($key, self::version($kind, $organizationId) + 1);
    }
}
