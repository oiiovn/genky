<?php

namespace App\Support;

use App\Models\AttendanceLog;
use App\Models\Employee;
use App\Models\Shift;
use Carbon\Carbon;

class DailyWage
{
    public static function payableMinutes(
        AttendanceLog $log,
        ?Shift $shift,
        bool $payFromShiftStart,
        ?Carbon $until = null,
    ): int {
        $checkOut = $until ?? $log->check_out_at;
        if (! $log->check_in_at || ! $checkOut) {
            return 0;
        }

        $actual = $log->total_minutes;
        if ($actual === null || $until) {
            $actual = max(0, (int) round($log->check_in_at->diffInMinutes($checkOut)) - (int) $log->break_minutes);
        }
        $actual = (int) $actual;
        if ($actual < 0) {
            $actual = 0;
        }

        if (! $payFromShiftStart || ! $shift) {
            return $actual;
        }

        $tz = 'Asia/Ho_Chi_Minh';
        $date = $log->work_date?->toDateString()
            ?? $log->check_in_at->copy()->timezone($tz)->toDateString();
        $time = substr((string) $shift->start_time, 0, 5);
        $shiftStart = Carbon::parse($date.' '.$time, $tz);
        $checkIn = $log->check_in_at->copy()->timezone($tz);
        $end = $checkOut->copy()->timezone($tz);
        $start = $checkIn->lt($shiftStart) ? $shiftStart : $checkIn;
        if ($start->gte($end)) {
            return 0;
        }

        return max(0, (int) round($start->diffInMinutes($end)) - (int) $log->break_minutes);
    }

    public static function amount(Employee $employee, int $minutes): int
    {
        $rate = (float) $employee->salary_amount;
        if ($minutes <= 0 || $rate <= 0) {
            return 0;
        }

        if (in_array($employee->salary_type, ['hourly', 'shift'], true)) {
            return (int) round(($rate * $minutes) / 60);
        }

        $hours = $minutes / 60;

        return (int) round(min($rate * 1.2, ($rate / 176) * $hours));
    }
}
