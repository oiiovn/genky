export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";

export type LeaveType = "annual" | "unpaid" | "sick" | "personal";

export type LeaveRequest = {
  id: string;
  employee_id: number;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  created_at: string;
};

const TYPE_LABELS: Record<LeaveType, string> = {
  annual: "Nghỉ phép năm",
  unpaid: "Nghỉ không lương",
  sick: "Nghỉ ốm",
  personal: "Việc riêng",
};

const STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

export { TYPE_LABELS as leaveTypeLabels, STATUS_LABELS as leaveStatusLabels };

function key(employeeId: number) {
  return `genky_staff_leave_${employeeId}`;
}

export function listLeaveRequests(employeeId: number): LeaveRequest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(employeeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LeaveRequest[];
    return Array.isArray(parsed)
      ? parsed.sort((a, b) => b.created_at.localeCompare(a.created_at))
      : [];
  } catch {
    return [];
  }
}

export function saveLeaveRequest(
  employeeId: number,
  input: Omit<LeaveRequest, "id" | "employee_id" | "status" | "created_at">,
): LeaveRequest {
  const rows = listLeaveRequests(employeeId);
  const row: LeaveRequest = {
    ...input,
    id: `lv_${Date.now()}`,
    employee_id: employeeId,
    status: "pending",
    created_at: new Date().toISOString(),
  };
  localStorage.setItem(key(employeeId), JSON.stringify([row, ...rows]));
  return row;
}

export function cancelLeaveRequest(employeeId: number, id: string): void {
  const rows = listLeaveRequests(employeeId).map((r) =>
    r.id === id && r.status === "pending"
      ? { ...r, status: "cancelled" as const }
      : r,
  );
  localStorage.setItem(key(employeeId), JSON.stringify(rows));
}

export function countLeaveDays(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}
