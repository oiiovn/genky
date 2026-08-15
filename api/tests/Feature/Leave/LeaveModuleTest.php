<?php

namespace Tests\Feature\Leave;

use App\Models\AttendanceLog;
use App\Models\LeaveRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LeaveModuleTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @return array{token: string, branch_id: int, org_id: int}
     */
    protected function seedOwnerWithBranch(): array
    {
        $register = $this->postJson('/api/auth/register', [
            'name' => 'Vũ',
            'email' => 'owner-leave@fresh.test',
            'password' => 'Password1!',
            'password_confirmation' => 'Password1!',
            'organization_name' => 'FRESH Leave',
        ])->json();

        $token = $register['access_token'];
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->postJson('/api/onboarding/organization', [
            'name' => 'FRESH Leave',
            'phone' => '0901111111',
            'address' => 'Gò Vấp',
        ]);
        $this->app['auth']->forgetGuards();

        $branch = $this->withToken($token)->postJson('/api/onboarding/branch', [
            'name' => 'Lê Văn Quới',
            'address' => '123 Lê Văn Quới',
            'check_in_radius_meters' => 100,
        ])->json('branch');
        $this->app['auth']->forgetGuards();

        return [
            'token' => $token,
            'branch_id' => $branch['id'],
            'org_id' => $register['organization']['id'],
        ];
    }

    public function test_approving_leave_writes_attendance_and_blocks_check_in(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $from = now()->toDateString();
        $to = now()->addDay()->toDateString();

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Nguyễn Nhi',
            'email' => 'nhi-leave@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'monthly',
            'salary_amount' => 7800000,
        ])->assertCreated()->json('data');

        $this->app['auth']->forgetGuards();

        $leave = $this->withToken($ctx['token'])->postJson('/api/leaves', [
            'employee_id' => $employee['id'],
            'type' => LeaveRequest::TYPE_UNPAID,
            'from' => $from,
            'to' => $to,
            'reason' => 'Việc gia đình',
        ])->assertCreated()->json('data');

        $this->assertSame(LeaveRequest::STATUS_APPROVED, $leave['status']);
        $this->assertSame(2, $leave['days']);

        $this->assertTrue(
            AttendanceLog::withoutGlobalScopes()
                ->where('employee_id', $employee['id'])
                ->whereDate('work_date', $from)
                ->where('status', AttendanceLog::STATUS_LEAVE)
                ->where('leave_type', LeaveRequest::TYPE_UNPAID)
                ->where('leave_request_id', $leave['id'])
                ->exists()
        );
        $this->assertTrue(
            AttendanceLog::withoutGlobalScopes()
                ->where('employee_id', $employee['id'])
                ->whereDate('work_date', $to)
                ->where('status', AttendanceLog::STATUS_LEAVE)
                ->exists()
        );

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->getJson('/api/attendances?date='.$from)
            ->assertOk()
            ->assertJsonPath('data.0.ui_status', 'on_leave')
            ->assertJsonPath('data.0.leave_type', LeaveRequest::TYPE_UNPAID);

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])
            ->postJson('/api/attendances/check-in', [
                'employee_id' => $employee['id'],
                'branch_id' => $ctx['branch_id'],
                'work_date' => $from,
                'check_in_time' => '08:00',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['employee_id']);
    }

    public function test_unpaid_leave_deducts_payroll_and_paid_leave_does_not_create_income(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $year = (int) now()->year;
        $month = (int) now()->month;
        $from = now()->toDateString();
        $to = now()->addDay()->toDateString();

        $unpaid = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Trần Không Lương',
            'email' => 'unpaid-leave@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'monthly',
            'salary_amount' => 7800000,
        ])->assertCreated()->json('data');

        $this->app['auth']->forgetGuards();

        $paid = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Lê Phép Năm',
            'email' => 'paid-leave@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
            'salary_type' => 'monthly',
            'salary_amount' => 7800000,
        ])->assertCreated()->json('data');

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/leaves', [
            'employee_id' => $unpaid['id'],
            'type' => LeaveRequest::TYPE_UNPAID,
            'from' => $from,
            'to' => $to,
            'reason' => 'Nghỉ không lương',
        ])->assertCreated();

        $this->app['auth']->forgetGuards();

        $this->withToken($ctx['token'])->postJson('/api/leaves', [
            'employee_id' => $paid['id'],
            'type' => LeaveRequest::TYPE_ANNUAL,
            'from' => $from,
            'to' => $to,
            'reason' => 'Nghỉ phép năm',
        ])->assertCreated();

        $this->app['auth']->forgetGuards();

        $list = $this->withToken($ctx['token'])
            ->getJson("/api/payrolls?year={$year}&month={$month}")
            ->assertOk()
            ->json();

        $unpaidRow = collect($list['data'])->firstWhere('id', $unpaid['id']);
        $paidRow = collect($list['data'])->firstWhere('id', $paid['id']);

        $this->assertNotNull($unpaidRow);
        $this->assertSame(2, $unpaidRow['unpaid_days']);
        $this->assertSame(2, $unpaidRow['leave_days']);
        $this->assertSame((int) round(7800000 / 26) * 2, $unpaidRow['deductions']);
        $this->assertSame(0, $unpaidRow['income']);
        $this->assertSame(0, $unpaidRow['net']);
        $this->assertSame(0, $unpaidRow['total_minutes']);

        $this->assertNotNull($paidRow);
        $this->assertSame(0, $paidRow['unpaid_days']);
        $this->assertSame(2, $paidRow['paid_leave_days']);
        $this->assertSame(0, $paidRow['deductions']);
        $this->assertSame(0, $paidRow['income']);
        $this->assertSame(0, $paidRow['net']);
        $this->assertSame(0, $paidRow['total_minutes']);

        $this->app['auth']->forgetGuards();

        $timesheet = $this->withToken($ctx['token'])
            ->getJson("/api/timesheets?year={$year}&month={$month}")
            ->assertOk()
            ->json();

        $tsUnpaid = collect($timesheet['data'])->firstWhere('id', $unpaid['id']);
        $this->assertSame(2, $tsUnpaid['leave_days']);
    }

    public function test_review_pending_leave_syncs_attendance(): void
    {
        $ctx = $this->seedOwnerWithBranch();
        $from = now()->toDateString();

        $employee = $this->withToken($ctx['token'])->postJson('/api/employees', [
            'full_name' => 'Phạm Duyệt',
            'email' => 'review-leave@fresh.test',
            'branch_ids' => [$ctx['branch_id']],
        ])->assertCreated()->json('data');

        $this->app['auth']->forgetGuards();

        $leave = LeaveRequest::withoutGlobalScopes()->create([
            'organization_id' => $ctx['org_id'],
            'employee_id' => $employee['id'],
            'type' => LeaveRequest::TYPE_SICK,
            'starts_on' => $from,
            'ends_on' => $from,
            'days' => 1,
            'reason' => 'Ốm',
            'status' => LeaveRequest::STATUS_PENDING,
        ]);

        $this->withToken($ctx['token'])
            ->postJson("/api/leaves/{$leave->id}/review", [
                'status' => LeaveRequest::STATUS_APPROVED,
                'note' => 'Đồng ý',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', LeaveRequest::STATUS_APPROVED);

        $this->assertTrue(
            AttendanceLog::withoutGlobalScopes()
                ->where('employee_id', $employee['id'])
                ->whereDate('work_date', $from)
                ->where('status', AttendanceLog::STATUS_LEAVE)
                ->where('leave_type', LeaveRequest::TYPE_SICK)
                ->where('leave_request_id', $leave->id)
                ->exists()
        );
    }
}
