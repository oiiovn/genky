import { getAccessToken } from "@/lib/api";
import { apiUrl } from "@/lib/api-base";

export type AttendanceUiStatus =
  | "checked_out"
  | "working"
  | "not_checked_in"
  | "on_leave"
  | "absent";
export type CheckLabelTone = "early" | "ontime" | "late" | "working" | "none";

export type AttendanceRow = {
  id: number | null;
  employee_id: number;
  employee_code: string;
  full_name: string;
  avatar: string | null;
  position: string;
  branch_id: number | null;
  branch_name?: string | null;
  shift_id: number | null;
  shift_name: string;
  shift_time: string;
  check_in: string | null;
  check_in_label: string | null;
  check_in_tone: CheckLabelTone;
  check_out: string | null;
  check_out_label: string | null;
  check_out_tone: CheckLabelTone;
  total_minutes: number | null;
  total_hours: string | null;
  status: string | null;
  ui_status: AttendanceUiStatus;
  leave_type?: string | null;
  leave_type_label?: string | null;
  leave_request_id?: number | null;
  location: string | null;
  work_date: string;
  note: string | null;
  break_minutes?: number | null;
};

export type AttendanceStats = {
  total: number;
  checked_in: number;
  working: number;
  not_checked_in: number;
  checked_out?: number;
  on_leave?: number;
};

export type ShiftTodayCard = {
  id: number;
  name: string;
  time: string;
  status: "ongoing" | "upcoming" | "done" | string;
  checked: number;
  total: number;
  ontime: number;
  late: number;
  missing: number;
};

export type AttendanceListMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
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

export const statusLabel: Record<AttendanceUiStatus, string> = {
  checked_out: "Đã check-out",
  working: "Đang làm việc",
  not_checked_in: "Chưa check-in",
  on_leave: "Nghỉ phép",
  absent: "Vắng mặt",
};

export const statusTone: Record<AttendanceUiStatus, string> = {
  checked_out: "bg-emerald-50 text-emerald-600",
  working: "bg-amber-50 text-amber-600",
  not_checked_in: "bg-rose-50 text-rose-600",
  on_leave: "bg-violet-50 text-violet-600",
  absent: "bg-slate-100 text-slate-600",
};

export const checkToneClass: Record<CheckLabelTone, string> = {
  early: "text-emerald-600",
  ontime: "text-emerald-600",
  late: "text-rose-500",
  working: "text-amber-600",
  none: "text-slate-400",
};

export async function fetchAttendanceOverview(params: {
  date?: string;
  branch_id?: number | "";
}): Promise<{ dashboard: AttendanceStats; shifts: ShiftTodayCard[] }> {
  const q = new URLSearchParams();
  if (params.date) q.set("date", params.date);
  if (params.branch_id) q.set("branch_id", String(params.branch_id));
  const res = await fetch(`${apiUrl()}/attendances/overview?${q}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as { dashboard: AttendanceStats; shifts: ShiftTodayCard[] };
}

export async function fetchMyAttendances(params: {
  date?: string;
  from?: string;
  to?: string;
}): Promise<AttendanceRow[]> {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (!params.from && !params.to && params.date) q.set("date", params.date);
  const res = await fetch(`${apiUrl()}/attendances/mine?${q}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return (json.data ?? []) as AttendanceRow[];
}

export async function fetchAttendances(params: {
  date?: string;
  from?: string;
  to?: string;
  branch_id?: number | "";
  shift_id?: number | "";
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}): Promise<{ data: AttendanceRow[]; meta: AttendanceListMeta }> {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (!params.from && !params.to && params.date) q.set("date", params.date);
  if (params.branch_id) q.set("branch_id", String(params.branch_id));
  if (params.shift_id) q.set("shift_id", String(params.shift_id));
  if (params.status) q.set("status", params.status);
  if (params.search) q.set("search", params.search);
  if (params.page) q.set("page", String(params.page));
  q.set("per_page", String(params.per_page ?? 10));

  const res = await fetch(`${apiUrl()}/attendances?${q}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function checkInAttendance(payload: {
  employee_id: number;
  branch_id: number;
  shift_id?: number | null;
  location_label?: string;
  work_date?: string;
  check_in_time?: string;
}): Promise<AttendanceRow> {
  const res = await fetch(`${apiUrl()}/attendances/check-in`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as AttendanceRow;
}

export async function checkOutAttendance(payload: {
  employee_id: number;
  branch_id: number;
  work_date?: string;
  check_out_time?: string;
  note?: string;
}): Promise<AttendanceRow> {
  const res = await fetch(`${apiUrl()}/attendances/check-out`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as AttendanceRow;
}

export async function exportAttendances(params: {
  date?: string;
  from?: string;
  to?: string;
  branch_id?: number | "";
}): Promise<void> {
  const q = new URLSearchParams();
  if (params.from) q.set("from", params.from);
  if (params.to) q.set("to", params.to);
  if (!params.from && !params.to && params.date) q.set("date", params.date);
  if (params.branch_id) q.set("branch_id", String(params.branch_id));
  const res = await fetch(`${apiUrl()}/attendances/export?${q}`, {
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance-${params.from ?? params.date ?? "export"}${params.to ? "-"+params.to : ""}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function fetchAttendance(id: number): Promise<AttendanceRow> {
  const res = await fetch(`${apiUrl()}/attendances/${id}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as AttendanceRow;
}

export async function updateAttendance(
  id: number,
  payload: {
    check_in_at?: string | null;
    check_out_at?: string | null;
    break_minutes?: number | null;
    location_label?: string | null;
    note?: string | null;
    shift_id?: number | null;
    reason?: string;
  },
): Promise<AttendanceRow> {
  const res = await fetch(`${apiUrl()}/attendances/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as AttendanceRow;
}

export async function deleteAttendance(id: number): Promise<void> {
  const res = await fetch(`${apiUrl()}/attendances/${id}`, {
    method: "DELETE",
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function deleteSyntheticAttendance(payload: {
  employee_id: number;
  branch_id: number;
  work_date: string;
}): Promise<void> {
  const res = await fetch(`${apiUrl()}/attendances/synthetic`, {
    method: "DELETE",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
}
