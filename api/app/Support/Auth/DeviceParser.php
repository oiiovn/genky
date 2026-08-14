<?php

namespace App\Support\Auth;

use Carbon\CarbonInterface;

class DeviceParser
{
    /**
     * @return array{name: string, detail: string, kind: string}
     */
    public static function parse(?string $userAgent): array
    {
        $ua = trim((string) $userAgent);

        if ($ua === '') {
            return [
                'name' => 'Thiết bị không xác định',
                'detail' => 'Không rõ hệ điều hành',
                'kind' => 'desktop',
            ];
        }

        $kind = 'desktop';
        if (preg_match('/iPad|Tablet|PlayBook/i', $ua) === 1) {
            $kind = 'tablet';
        } elseif (preg_match('/Mobile|Android|iPhone|iPod/i', $ua) === 1) {
            $kind = 'phone';
        }

        $os = 'Unknown';
        if (str_contains($ua, 'Android')) {
            $os = 'Android';
        } elseif (preg_match('/iPhone|iPad|iPod/', $ua) === 1) {
            $os = 'iOS';
        } elseif (str_contains($ua, 'Mac OS') || str_contains($ua, 'Macintosh')) {
            $os = 'macOS';
        } elseif (str_contains($ua, 'Windows')) {
            $os = 'Windows';
        } elseif (str_contains($ua, 'Linux')) {
            $os = 'Linux';
        }

        $browser = 'Trình duyệt';
        if (str_contains($ua, 'Edg/')) {
            $browser = 'Edge';
        } elseif (str_contains($ua, 'Chrome/')) {
            $browser = 'Chrome';
        } elseif (str_contains($ua, 'Firefox/')) {
            $browser = 'Firefox';
        } elseif (str_contains($ua, 'Safari/') && ! str_contains($ua, 'Chrome/')) {
            $browser = 'Safari';
        }

        $name = $browser.' trên '.$os;
        if (str_contains($ua, 'iPhone')) {
            $name = 'iPhone · '.$browser;
        } elseif (str_contains($ua, 'iPad')) {
            $name = 'iPad · '.$browser;
        }

        return [
            'name' => $name,
            'detail' => $os,
            'kind' => $kind,
        ];
    }

    public static function location(?string $ip): string
    {
        $ip = trim((string) $ip);
        if ($ip === '' || $ip === '127.0.0.1' || $ip === '::1') {
            return 'Máy này';
        }

        return $ip;
    }

    public static function timeLabel(?CarbonInterface $at): string
    {
        if (! $at) {
            return '—';
        }

        $at = $at->timezone('Asia/Ho_Chi_Minh');
        $now = now('Asia/Ho_Chi_Minh');

        if ($at->gt($now->copy()->subMinute())) {
            return 'Vừa xong';
        }
        if ($at->isToday()) {
            $minutes = (int) abs($now->diffInMinutes($at));
            if ($minutes < 60) {
                return $minutes.' phút trước';
            }

            return (int) abs($now->diffInHours($at)).' giờ trước';
        }
        if ($at->isYesterday()) {
            return 'Hôm qua';
        }

        return $at->format('d/m/Y H:i');
    }

    public static function historyTime(?CarbonInterface $at): string
    {
        if (! $at) {
            return '—';
        }

        return $at->timezone('Asia/Ho_Chi_Minh')->format('d/m/Y H:i');
    }
}
