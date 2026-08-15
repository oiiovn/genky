<?php

namespace App\Services\Staff;

use App\Models\AttendanceLog;
use App\Models\Employee;
use App\Models\PayrollEntry;
use App\Models\User;
use App\Services\Employee\EmployeeService;
use App\Support\Authorization\EffectivePermission;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

class StaffProfileService
{
    public function __construct(private readonly EmployeeService $employees)
    {
    }

    public function employeeFor(User $user): Employee
    {
        $employee = Employee::query()
            ->with(['position', 'role', 'branches'])
            ->where('user_id', $user->id)
            ->first();

        if (! $employee) {
            throw ValidationException::withMessages([
                'employee' => ['Tài khoản chưa gắn hồ sơ nhân viên.'],
            ]);
        }

        return $employee;
    }

    /**
     * @return array<string, mixed>
     */
    public function profile(User $user): array
    {
        $employee = $this->employeeFor($user);
        $now = Carbon::now('Asia/Ho_Chi_Minh');
        $today = $now->toDateString();
        $monthStart = $now->copy()->startOfMonth()->toDateString();
        $monthEnd = $now->copy()->endOfMonth()->toDateString();

        $scansToday = AttendanceLog::query()
            ->where('employee_id', $employee->id)
            ->whereDate('work_date', $today)
            ->whereNotNull('check_in_at')
            ->where(function ($q) {
                $q->where('device', 'like', '%qr%')
                    ->orWhere('device', 'like', '%QR%')
                    ->orWhere('note', 'like', '%QR%');
            })
            ->count();

        if ($scansToday === 0) {
            $scansToday = AttendanceLog::query()
                ->where('employee_id', $employee->id)
                ->whereDate('work_date', $today)
                ->whereNotNull('check_in_at')
                ->count();
        }

        $attendanceMonth = AttendanceLog::query()
            ->where('employee_id', $employee->id)
            ->whereBetween('work_date', [$monthStart, $monthEnd])
            ->whereNotNull('check_in_at')
            ->where('status', '!=', AttendanceLog::STATUS_LEAVE)
            ->count();

        $payroll = PayrollEntry::query()
            ->where('employee_id', $employee->id)
            ->where('year', (int) $now->year)
            ->where('month', (int) $now->month)
            ->first();

        $access = EffectivePermission::for($user);

        return [
            'employee' => $this->employees->payload($employee),
            'role_label' => $access->roleLabel(),
            'stats' => [
                'scans_today' => $scansToday,
                'attendance_month' => $attendanceMonth,
                'payroll_net' => (int) ($payroll?->net ?? 0),
                'payroll_month' => $now->format('m/Y'),
            ],
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function update(User $user, array $data): array
    {
        $employee = $this->employeeFor($user);

        $allowed = collect($data)->only([
            'full_name',
            'phone',
            'gender',
            'date_of_birth',
            'address',
            'identity_number',
        ])->all();

        if ($allowed === []) {
            throw ValidationException::withMessages([
                'profile' => ['Không có dữ liệu để cập nhật.'],
            ]);
        }

        $employee->fill($allowed)->save();

        if (isset($allowed['full_name']) && filled($allowed['full_name'])) {
            $user->forceFill(['name' => $allowed['full_name']])->save();
        }

        if (array_key_exists('phone', $allowed)) {
            $user->forceFill(['phone' => $allowed['phone']])->save();
        }

        return $this->profile($user->fresh());
    }
}
