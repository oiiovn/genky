<?php

namespace App\Services\Leave;

use App\Models\AttendanceLog;
use App\Models\Employee;
use App\Models\LeaveRequest;
use App\Models\ShiftAssignment;
use App\Support\Auth\DeviceParser;
use App\Support\Authorization\LeavePermission;
use App\Support\Tenancy\TenantContext;
use Carbon\Carbon;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class LeaveService
{
    public function list(array $filters = []): array
    {
        $permission = LeavePermission::for();
        $query = LeaveRequest::query()
            ->with(['employee.position', 'reviewer']);

        if (! $permission->canReview()) {
            $own = $permission->ownEmployee();
            if (! $own) {
                return [
                    'data' => [],
                    'stats' => $this->emptyStats(),
                ];
            }
            $query->where('employee_id', $own->id);
        }

        $stats = [
            'total' => (clone $query)->count(),
            'pending' => (clone $query)->where('status', LeaveRequest::STATUS_PENDING)->count(),
            'approved' => (clone $query)->where('status', LeaveRequest::STATUS_APPROVED)->count(),
            'rejected' => (clone $query)->where('status', LeaveRequest::STATUS_REJECTED)->count(),
        ];

        $status = trim((string) ($filters['status'] ?? ''));
        $type = trim((string) ($filters['type'] ?? ''));
        $search = trim((string) ($filters['search'] ?? ''));
        $from = trim((string) ($filters['from'] ?? $filters['date_from'] ?? ''));
        $to = trim((string) ($filters['to'] ?? $filters['date_to'] ?? ''));

        if ($status !== '') {
            $query->where('status', $status);
        }
        if ($type !== '') {
            $query->where('type', $type);
        }
        if ($from !== '' && $to !== '') {
            $query->whereDate('starts_on', '<=', $to)
                ->whereDate('ends_on', '>=', $from);
        }
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('reason', 'like', '%'.$search.'%')
                    ->orWhereHas('employee', function ($eq) use ($search) {
                        $eq->where('full_name', 'like', '%'.$search.'%')
                            ->orWhere('employee_code', 'like', '%'.$search.'%');
                    });
            });
        }

        $rows = $query->orderByDesc('created_at')
            ->limit(200)
            ->get()
            ->map(fn (LeaveRequest $row) => $this->payload($row))
            ->values()
            ->all();

        return [
            'data' => $rows,
            'stats' => $stats,
        ];
    }

    /**
     * @return array{total: int, pending: int, approved: int, rejected: int}
     */
    protected function emptyStats(): array
    {
        return [
            'total' => 0,
            'pending' => 0,
            'approved' => 0,
            'rejected' => 0,
        ];
    }

    public function findOrFail(int $id): LeaveRequest
    {
        $row = LeaveRequest::query()->findOrFail($id);
        LeavePermission::for()->assertCanView($row);

        return $row;
    }

    public function pendingForDashboard(): array
    {
        try {
            if (! LeavePermission::for()->canReview()) {
                return [];
            }

            return LeaveRequest::query()
                ->with(['employee.position'])
                ->where('status', LeaveRequest::STATUS_PENDING)
                ->orderByDesc('created_at')
                ->limit(12)
                ->get()
                ->map(fn (LeaveRequest $row) => $this->payload($row))
                ->values()
                ->all();
        } catch (\Throwable) {
            return [];
        }
    }

    public function create(array $data): array
    {
        $permission = LeavePermission::for();
        $autoApprove = false;

        if ($permission->canReview() && ! empty($data['employee_id'])) {
            $employee = Employee::query()->find((int) $data['employee_id']);
            if (! $employee) {
                throw ValidationException::withMessages([
                    'employee_id' => ['Không tìm thấy nhân viên.'],
                ]);
            }
            $autoApprove = true;
        } else {
            $employee = $permission->assertCanCreate();
        }

        $starts = Carbon::parse($data['from'])->startOfDay();
        $ends = Carbon::parse($data['to'])->startOfDay();

        if ($ends->lt($starts)) {
            throw ValidationException::withMessages([
                'to' => ['Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.'],
            ]);
        }

        $days = (int) $starts->diffInDays($ends) + 1;
        $this->assertNoOverlap((int) $employee->id, $starts, $ends);

        $row = DB::transaction(function () use ($data, $employee, $starts, $ends, $days, $autoApprove) {
            $created = LeaveRequest::query()->create([
                'organization_id' => TenantContext::id(),
                'employee_id' => $employee->id,
                'type' => $data['type'],
                'starts_on' => $starts->toDateString(),
                'ends_on' => $ends->toDateString(),
                'days' => $days,
                'reason' => trim((string) $data['reason']),
                'status' => $autoApprove ? LeaveRequest::STATUS_APPROVED : LeaveRequest::STATUS_PENDING,
                'reviewed_by' => $autoApprove ? auth()->id() : null,
                'reviewed_at' => $autoApprove ? now() : null,
                'review_note' => $autoApprove ? 'Tạo bởi quản lý' : null,
            ]);

            if ($autoApprove) {
                $this->cancelAssignmentsInLeaveRange($created);
                $this->applyToAttendance($created);
            }

            return $created;
        });

        return $this->payload($row->load(['employee', 'reviewer']));
    }

    public function cancel(LeaveRequest $leave): array
    {
        $permission = LeavePermission::for();
        $own = $permission->ownEmployee();

        if (! $own || (int) $own->id !== (int) $leave->employee_id) {
            throw new AuthorizationException('Chỉ được hủy đơn của chính mình.');
        }

        if ($leave->status !== LeaveRequest::STATUS_PENDING) {
            throw ValidationException::withMessages([
                'status' => ['Chỉ hủy được đơn đang chờ duyệt.'],
            ]);
        }

        $leave->forceFill(['status' => LeaveRequest::STATUS_CANCELLED])->save();

        return $this->payload($leave->fresh('employee'));
    }

    public function review(LeaveRequest $leave, string $status, ?string $note = null): array
    {
        LeavePermission::for()->assertCanReview();

        if ($leave->status !== LeaveRequest::STATUS_PENDING) {
            throw ValidationException::withMessages([
                'status' => ['Đơn này đã được xử lý.'],
            ]);
        }

        $leave = DB::transaction(function () use ($leave, $status, $note) {
            $leave->forceFill([
                'status' => $status,
                'reviewed_by' => auth()->id(),
                'reviewed_at' => now(),
                'review_note' => $note,
            ])->save();

            if ($status === LeaveRequest::STATUS_APPROVED) {
                $this->cancelAssignmentsInLeaveRange($leave);
                $this->applyToAttendance($leave);
            }

            return $leave;
        });

        return $this->payload($leave->fresh(['employee']));
    }

    public function update(LeaveRequest $leave, array $data): array
    {
        LeavePermission::for()->assertCanReview();

        $starts = Carbon::parse($data['from'])->startOfDay();
        $ends = Carbon::parse($data['to'])->startOfDay();

        if ($ends->lt($starts)) {
            throw ValidationException::withMessages([
                'to' => ['Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.'],
            ]);
        }

        $employeeId = (int) ($data['employee_id'] ?? $leave->employee_id);
        $employee = Employee::query()->find($employeeId);
        if (! $employee) {
            throw ValidationException::withMessages([
                'employee_id' => ['Không tìm thấy nhân viên.'],
            ]);
        }

        $days = (int) $starts->diffInDays($ends) + 1;
        $this->assertNoOverlap($employeeId, $starts, $ends, (int) $leave->id);
        $wasApproved = $leave->status === LeaveRequest::STATUS_APPROVED;

        $leave = DB::transaction(function () use ($leave, $data, $employee, $starts, $ends, $days, $wasApproved) {
            if ($wasApproved) {
                $this->clearAttendanceForLeave($leave);
            }

            $leave->forceFill([
                'employee_id' => $employee->id,
                'type' => $data['type'],
                'starts_on' => $starts->toDateString(),
                'ends_on' => $ends->toDateString(),
                'days' => $days,
                'reason' => trim((string) $data['reason']),
            ])->save();

            $leave->refresh();

            if ($leave->status === LeaveRequest::STATUS_APPROVED) {
                $this->cancelAssignmentsInLeaveRange($leave);
                $this->applyToAttendance($leave);
            }

            return $leave;
        });

        return $this->payload($leave->fresh(['employee', 'reviewer']));
    }

    public function delete(LeaveRequest $leave): void
    {
        LeavePermission::for()->assertCanReview();

        DB::transaction(function () use ($leave) {
            $this->clearAttendanceForLeave($leave);
            $leave->delete();
        });
    }

    protected function clearAttendanceForLeave(LeaveRequest $leave): void
    {
        AttendanceLog::query()
            ->where('leave_request_id', $leave->id)
            ->where('status', AttendanceLog::STATUS_LEAVE)
            ->whereNull('check_in_at')
            ->delete();
    }

    protected function assertNoOverlap(int $employeeId, Carbon $starts, Carbon $ends, ?int $ignoreId = null): void
    {
        $exists = LeaveRequest::query()
            ->where('employee_id', $employeeId)
            ->whereIn('status', [
                LeaveRequest::STATUS_PENDING,
                LeaveRequest::STATUS_APPROVED,
            ])
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->whereDate('starts_on', '<=', $ends->toDateString())
            ->whereDate('ends_on', '>=', $starts->toDateString())
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'from' => ['Khoảng ngày này đã trùng với đơn nghỉ khác.'],
            ]);
        }
    }

    protected function cancelAssignmentsInLeaveRange(LeaveRequest $leave): void
    {
        ShiftAssignment::query()
            ->where('employee_id', $leave->employee_id)
            ->where('status', ShiftAssignment::STATUS_ASSIGNED)
            ->whereDate('date', '>=', $leave->starts_on->toDateString())
            ->whereDate('date', '<=', $leave->ends_on->toDateString())
            ->update([
                'status' => ShiftAssignment::STATUS_CANCELLED,
                'updated_at' => now(),
            ]);
    }

    protected function applyToAttendance(LeaveRequest $leave): void
    {
        $employee = $leave->employee()->with('branches')->first();
        $branch = $employee?->primaryBranch();
        if (! $employee || ! $branch) {
            throw ValidationException::withMessages([
                'employee_id' => ['Nhân viên chưa gắn chi nhánh, không ghi được ngày nghỉ.'],
            ]);
        }

        $label = LeaveRequest::TYPE_LABELS[$leave->type] ?? 'Nghỉ phép';
        $reason = trim((string) $leave->reason);
        $note = $reason !== '' ? $label.': '.$reason : $label;
        $cursor = $leave->starts_on->copy()->startOfDay();
        $end = $leave->ends_on->copy()->startOfDay();

        while ($cursor->lte($end)) {
            $date = $cursor->toDateString();
            $assignment = ShiftAssignment::query()
                ->where('employee_id', $employee->id)
                ->whereDate('date', $date)
                ->where('status', ShiftAssignment::STATUS_ASSIGNED)
                ->first();

            $existing = AttendanceLog::query()
                ->where('employee_id', $employee->id)
                ->whereDate('work_date', $date)
                ->lockForUpdate()
                ->first();

            if ($existing && $existing->check_in_at) {
                $cursor->addDay();

                continue;
            }

            $payload = [
                'organization_id' => $leave->organization_id,
                'branch_id' => $existing?->branch_id ?? $assignment?->branch_id ?? $branch->id,
                'employee_id' => $employee->id,
                'shift_id' => $existing?->shift_id ?? $assignment?->shift_id,
                'work_date' => $date,
                'status' => AttendanceLog::STATUS_LEAVE,
                'leave_request_id' => $leave->id,
                'leave_type' => $leave->type,
                'note' => $note,
                'total_minutes' => 0,
                'check_in_at' => null,
                'check_out_at' => null,
                'created_by' => auth()->id(),
            ];

            if ($existing) {
                $existing->fill($payload)->save();
            } else {
                AttendanceLog::query()->create($payload);
            }

            $cursor->addDay();
        }
    }

    public function payload(LeaveRequest $leave): array
    {
        $leave->loadMissing(['employee.position', 'reviewer']);
        $employee = $leave->employee;

        return [
            'id' => $leave->id,
            'employee_id' => $leave->employee_id,
            'employee_code' => $employee?->employee_code,
            'full_name' => $employee?->full_name,
            'avatar' => $employee?->resolvedAvatarUrl(),
            'position' => $employee?->position?->name,
            'type' => $leave->type,
            'type_label' => LeaveRequest::TYPE_LABELS[$leave->type] ?? $leave->type,
            'from' => $leave->starts_on?->toDateString(),
            'to' => $leave->ends_on?->toDateString(),
            'days' => (int) $leave->days,
            'reason' => $leave->reason,
            'status' => $leave->status,
            'review_note' => $leave->review_note,
            'reviewed_at' => $leave->reviewed_at?->toIso8601String(),
            'reviewer_name' => $leave->reviewer?->name,
            'created_at' => $leave->created_at?->toIso8601String(),
            'time' => DeviceParser::timeLabel($leave->created_at),
        ];
    }
}
