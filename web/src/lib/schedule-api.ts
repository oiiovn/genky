import { getAccessToken } from "@/lib/api";
import { apiUrl } from "@/lib/api-base";

export type ScheduleAssignment = {
  id: number;
  date: string;
  status: string;
  note: string | null;
  employee: {
    id: number;
    employee_code: string;
    full_name: string;
  } | null;
  shift: {
    id: number;
    name: string;
    code: string;
    start_time: string;
    end_time: string;
    color: string;
  } | null;
  branch: {
    id: number;
    name: string;
  } | null;
};

export type ScheduleFilters = {
  branch_id?: number | "";
  shift_id?: number | "";
  employee_id?: number | "";
  date_from?: string;
  date_to?: string;
  status?: string;
};

export type AssignShiftPayload = {
  employee_id: number;
  shift_id: number;
  branch_id: number;
  date: string;
  note?: string;
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
      if (Array.isArray(first) && first[0]) return first[0];
    }
    if (data.message) return data.message;
  } catch {
    /* ignore */
  }
  return "Yêu cầu thất bại.";
}

export async function fetchScheduleAssignments(
  filters: ScheduleFilters = {},
  signal?: AbortSignal,
): Promise<ScheduleAssignment[]> {
  const params = new URLSearchParams();
  if (filters.branch_id) params.set("branch_id", String(filters.branch_id));
  if (filters.shift_id) params.set("shift_id", String(filters.shift_id));
  if (filters.employee_id) params.set("employee_id", String(filters.employee_id));
  if (filters.date_from) params.set("date_from", filters.date_from);
  if (filters.date_to) params.set("date_to", filters.date_to);
  if (filters.status) params.set("status", filters.status);

  const res = await fetch(`${apiUrl()}/shift-assignments?${params.toString()}`, {
    headers: authHeaders(false),
    cache: "no-store",
    signal,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return (json.data ?? []) as ScheduleAssignment[];
}

export async function createScheduleAssignment(
  payload: AssignShiftPayload,
): Promise<ScheduleAssignment> {
  const res = await fetch(`${apiUrl()}/shift-assignments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as ScheduleAssignment;
}

export async function deleteScheduleAssignment(id: number): Promise<void> {
  const res = await fetch(`${apiUrl()}/shift-assignments/${id}`, {
    method: "DELETE",
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
}
