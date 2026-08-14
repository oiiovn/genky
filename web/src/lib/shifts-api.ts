import { getAccessToken } from "@/lib/api";
import { apiUrl } from "@/lib/api-base";

export type ShiftStatus = "active" | "inactive";

export type Shift = {
  id: number;
  branch_id: number | null;
  name: string;
  code: string;
  start_time: string;
  end_time: string;
  crosses_midnight: boolean;
  duration_minutes: number;
  break_minutes: number;
  break_time: number;
  total_minutes: number;
  color: string;
  icon: string | null;
  description: string | null;
  capacity: number | null;
  status: ShiftStatus | string;
  employee_count: number;
  is_ongoing: boolean;
};

export type ShiftSummary = {
  total: number;
  active: number;
  active_percent: number;
  employees_today: number;
  ongoing_shifts: number;
  open_slots: number;
};

export type ShiftListMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export type ShiftFilters = {
  branch_id?: number | "";
  status?: string;
  search?: string;
  date?: string;
  page?: number;
  per_page?: number;
};

export type ShiftPayload = {
  name: string;
  code?: string;
  start_time: string;
  end_time: string;
  break_time?: number;
  color?: string;
  icon?: string | null;
  description?: string | null;
  capacity?: number | null;
  status?: string;
  branch_id?: number | null;
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

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function formatDurationLong(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} giờ ${String(m).padStart(2, "0")} phút`;
}

export async function fetchShifts(
  filters: ShiftFilters = {},
): Promise<{ data: Shift[]; meta: ShiftListMeta }> {
  const params = new URLSearchParams();
  if (filters.branch_id) params.set("branch_id", String(filters.branch_id));
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.date) params.set("date", filters.date);
  if (filters.page) params.set("page", String(filters.page));
  params.set("per_page", String(filters.per_page ?? 10));

  const res = await fetch(`${apiUrl()}/shifts?${params.toString()}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchShiftSummary(
  branchId?: number | "",
): Promise<ShiftSummary> {
  const params = new URLSearchParams();
  if (branchId) params.set("branch_id", String(branchId));
  const res = await fetch(`${apiUrl()}/shifts/summary?${params.toString()}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as ShiftSummary;
}

export async function createShift(payload: ShiftPayload): Promise<Shift> {
  const res = await fetch(`${apiUrl()}/shifts`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as Shift;
}

export async function updateShift(
  id: number,
  payload: Partial<ShiftPayload>,
): Promise<Shift> {
  const res = await fetch(`${apiUrl()}/shifts/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as Shift;
}

export async function deleteShift(id: number): Promise<void> {
  const res = await fetch(`${apiUrl()}/shifts/${id}`, {
    method: "DELETE",
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function importShifts(file: File, branchId?: number): Promise<{
  success: boolean;
  count: number;
}> {
  const form = new FormData();
  form.append("file", file);
  if (branchId) form.append("branch_id", String(branchId));

  const access = getAccessToken();
  const res = await fetch(`${apiUrl()}/shifts/import`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function exportShifts(branchId?: number): Promise<void> {
  const params = new URLSearchParams();
  if (branchId) params.set("branch_id", String(branchId));
  const res = await fetch(`${apiUrl()}/shifts/export?${params.toString()}`, {
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `shifts-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
