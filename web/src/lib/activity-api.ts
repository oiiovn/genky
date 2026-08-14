import { getAccessToken } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export type LogAction = "create" | "update" | "delete" | "login" | "logout";
export type LogResult = "success" | "fail";

export type SystemLog = {
  id: number;
  time: string;
  user_id: number | null;
  user_name: string;
  role: string;
  avatar: string | null;
  action: LogAction | string;
  action_label: string;
  object: string | null;
  result: LogResult | string;
  error?: string | null;
  ip: string;
  device: "desktop" | "phone" | string;
};

export type ActivityUser = {
  id: number;
  name: string;
};

export type ActivityMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
};

export type ActivityFilters = {
  search?: string;
  user_id?: number | "";
  action?: LogAction | "";
  result?: LogResult | "";
  from?: string;
  to?: string;
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

function queryOf(filters: ActivityFilters): string {
  const q = new URLSearchParams();
  if (filters.search) q.set("search", filters.search);
  if (filters.user_id) q.set("user_id", String(filters.user_id));
  if (filters.action) q.set("action", filters.action);
  if (filters.result) q.set("result", filters.result);
  if (filters.from) q.set("from", filters.from);
  if (filters.to) q.set("to", filters.to);
  if (filters.page) q.set("page", String(filters.page));
  if (filters.per_page) q.set("per_page", String(filters.per_page));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function fetchActivityLogs(filters: ActivityFilters = {}): Promise<{
  data: SystemLog[];
  users: ActivityUser[];
  meta: ActivityMeta;
}> {
  const res = await fetch(`${API_URL}/activity-logs${queryOf(filters)}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return {
    data: (json.data ?? []) as SystemLog[],
    users: (json.users ?? []) as ActivityUser[],
    meta: (json.meta ?? {
      current_page: 1,
      last_page: 1,
      per_page: 10,
      total: 0,
      from: null,
      to: null,
    }) as ActivityMeta,
  };
}

export async function exportActivityLogs(filters: ActivityFilters = {}): Promise<void> {
  const res = await fetch(`${API_URL}/activity-logs/export${queryOf(filters)}`, {
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `nhat-ky-he-thong-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
