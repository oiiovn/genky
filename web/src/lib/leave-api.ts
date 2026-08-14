import { getAccessToken } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export type LeaveStatus = "pending" | "approved" | "rejected" | "cancelled";
export type LeaveType = "annual" | "unpaid" | "sick" | "personal";

export type LeaveRequest = {
  id: number;
  employee_id: number;
  employee_code: string | null;
  full_name: string | null;
  avatar: string | null;
  position?: string | null;
  type: LeaveType | string;
  type_label: string;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  review_note?: string | null;
  reviewed_at?: string | null;
  reviewer_name?: string | null;
  created_at: string | null;
  time: string;
};

export type LeaveStats = {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
};

export type LeaveFilters = {
  status?: string;
  type?: string;
  search?: string;
};

export const leaveTypeLabels: Record<LeaveType, string> = {
  annual: "Nghỉ phép năm",
  unpaid: "Nghỉ không lương",
  sick: "Nghỉ ốm",
  personal: "Việc riêng",
};

export const leaveStatusLabels: Record<LeaveStatus, string> = {
  pending: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  cancelled: "Đã hủy",
};

function authHeaders(json = true): HeadersInit {
  const access = getAccessToken();
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(access ? { Authorization: `Bearer ${access}` } : {}),
  };
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (data.errors) {
      const first = Object.values(data.errors as Record<string, string[]>)[0];
      if (first?.[0]) return first[0];
    }
    if (data.message) return data.message as string;
  } catch {
    /* ignore */
  }
  return "Có lỗi xảy ra, vui lòng thử lại.";
}

export function countLeaveDays(from: string, to: string): number {
  const a = new Date(`${from}T12:00:00`).getTime();
  const b = new Date(`${to}T12:00:00`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b < a) return 0;
  return Math.floor((b - a) / 86400000) + 1;
}

export async function fetchLeaves(
  filters: LeaveFilters = {},
): Promise<{ data: LeaveRequest[]; stats: LeaveStats }> {
  const q = new URLSearchParams();
  if (filters.status) q.set("status", filters.status);
  if (filters.type) q.set("type", filters.type);
  if (filters.search) q.set("search", filters.search);
  const suffix = q.toString() ? `?${q}` : "";
  const res = await fetch(`${API_URL}/leaves${suffix}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return {
    data: (json.data ?? []) as LeaveRequest[],
    stats: (json.stats ?? {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    }) as LeaveStats,
  };
}

export async function createLeave(payload: {
  type: LeaveType;
  from: string;
  to: string;
  reason: string;
  employee_id?: number;
}): Promise<LeaveRequest> {
  const res = await fetch(`${API_URL}/leaves`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as LeaveRequest;
}

export async function cancelLeave(id: number): Promise<LeaveRequest> {
  const res = await fetch(`${API_URL}/leaves/${id}/cancel`, {
    method: "POST",
    headers: authHeaders(),
    body: "{}",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as LeaveRequest;
}

export async function reviewLeave(
  id: number,
  status: "approved" | "rejected",
  note?: string,
): Promise<LeaveRequest> {
  const res = await fetch(`${API_URL}/leaves/${id}/review`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ status, note }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as LeaveRequest;
}
