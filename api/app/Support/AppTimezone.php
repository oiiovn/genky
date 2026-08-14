<?php

namespace App\Support;

final class AppTimezone
{
    public const ZONE = 'Asia/Ho_Chi_Minh';

    public static function name(): string
    {
        return (string) config('app.timezone', self::ZONE);
    }
}
