<?php

namespace App\Support\Marketing;

final class OrderCode
{
    public static function normalize(string $code): string
    {
        $code = trim(str_replace(['–', '—'], '-', $code));
        $code = preg_replace('/\s+/', '', $code) ?? $code;

        if (preg_match('/^GF-?(\d{3,})$/i', $code, $m)) {
            return 'GF-'.$m[1];
        }

        if ($code !== '' && ! str_starts_with($code, '#') && preg_match('/^\d{4,}-\d{6,}$/', $code)) {
            return '#'.$code;
        }

        return $code;
    }

    public static function isShopeeFormat(string $code): bool
    {
        return (bool) preg_match('/^#\d{4,}-\d{6,}$/', self::normalize($code));
    }

    public static function isGrabFormat(string $code): bool
    {
        return (bool) preg_match('/^GF-\d{3,}$/', self::normalize($code));
    }

    public static function isValid(string $code): bool
    {
        return self::isShopeeFormat($code) || self::isGrabFormat($code);
    }

    /**
     * @return list<string>
     */
    public static function candidates(string $code): array
    {
        $normalized = self::normalize($code);

        if (self::isGrabFormat($normalized)) {
            $digits = substr($normalized, 3);

            return array_values(array_unique(array_filter(
                [$normalized, 'GF'.$digits, strtolower($normalized)],
                fn (string $value) => $value !== '',
            )));
        }

        $stripped = ltrim($normalized, '#');

        return array_values(array_unique(array_filter(
            [$normalized, '#'.$stripped, $stripped],
            fn (string $value) => $value !== '',
        )));
    }
}
