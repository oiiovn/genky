import { getAccessToken } from "@/lib/api";
import type { Employee } from "@/lib/employees-api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export type TimesheetStatus = "approved" | "pending";

export type TimesheetShiftBadge = {
  id: number;
  name: string;
  color: string;
  start_time: string;
  end_time: string;
};

export type TimesheetRow = {
  id: number;
  employee: Employee;
  department: string;
  shifts: TimesheetShiftBadge[];
  work_days: number;
  work_minutes: number;
  ot_minutes: number;
  leave_days: number;
  other_leave_days: number;
  total_days: number;
  status: TimesheetStatus;
  branch_ids: number[];
  approved_at?: string | null;
};

export type TimesheetStats = {
  employees: number;
  work_minutes: number;
  ot_minutes: number;
  avg_work_days: number;
  estimated_cost: number;
  employees_delta: number;
  work_hours_delta: number;
  ot_delta: number;
  avg_days_delta: number;
  cost_delta: number;
};

export type TimesheetListMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  year: number;
  month: number;
  from: string;
  to: string;
  label: string;
};

export type TimesheetListResponse = {
  data: TimesheetRow[];
  meta: TimesheetListMeta;
  stats: TimesheetStats;
  summary: { approved: number; pending: number };
  departments: string[];
};

export type TimesheetFilters = {
  year: number;
  month: number;
  branch_id?: number | "";
  department?: string;
  shift_id?: number | "";
  status?: "" | TimesheetStatus;
  search?: string;
  page?: number;
  per_page?: number;
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

function toQuery(filters: TimesheetFilters): URLSearchParams {
  const q = new URLSearchParams();
  q.set("year", String(filters.year));
  q.set("month", String(filters.month));
  if (filters.branch_id) q.set("branch_id", String(filters.branch_id));
  if (filters.department) q.set("department", filters.department);
  if (filters.shift_id) q.set("shift_id", String(filters.shift_id));
  if (filters.status) q.set("status", filters.status);
  if (filters.search) q.set("search", filters.search);
  if (filters.page) q.set("page", String(filters.page));
  q.set("per_page", String(filters.per_page ?? 10));
  return q;
}

export function monthBounds(year: number, month: number): {
  from: string;
  to: string;
  label: string;
} {
  const from = `${year}-${String(month).padStart(2, "0")}-01`;
  const last = new Date(year, month, 0).getDate();
  const to = `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
  return {
    from,
    to,
    label: `Tháng ${String(month).padStart(2, "0")}/${year}`,
  };
}

export function formatHours(minutes: number): string {
  const h = minutes / 60;
  if (h >= 1000) {
    return `${h.toLocaleString("vi-VN", { maximumFractionDigits: 0 })}h`;
  }
  return `${h.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}h`;
}

export function formatMoney(amount: number): string {
  return `${Math.round(amount).toLocaleString("vi-VN")}đ`;
}

export async function fetchTimesheets(
  filters: TimesheetFilters,
): Promise<TimesheetListResponse> {
  const res = await fetch(`${API_URL}/timesheets?${toQuery(filters)}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchTimesheetDashboard(
  filters: Omit<TimesheetFilters, "page" | "per_page">,
): Promise<TimesheetStats> {
  const q = toQuery({ ...filters, page: 1, per_page: 1 });
  q.delete("page");
  q.delete("per_page");
  const res = await fetch(`${API_URL}/timesheets/dashboard?${q}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as TimesheetStats;
}

export async function generateTimesheet(payload: {
  year: number;
  month: number;
  branch_id?: number | null;
}): Promise<{ created: number; total_employees: number }> {
  const res = await fetch(`${API_URL}/timesheets/generate`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data;
}

export async function approveTimesheets(payload: {
  year: number;
  month: number;
  employee_ids: number[];
  status?: TimesheetStatus;
}): Promise<{ count: number; status: TimesheetStatus }> {
  const res = await fetch(`${API_URL}/timesheets/approve`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data;
}

export async function exportTimesheets(
  filters: Omit<TimesheetFilters, "page" | "per_page">,
): Promise<void> {
  const q = toQuery({ ...filters, page: 1, per_page: 1 });
  q.delete("page");
  q.delete("per_page");
  const res = await fetch(`${API_URL}/timesheets/export?${q}`, {
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timesheet-${filters.year}-${String(filters.month).padStart(2, "0")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
