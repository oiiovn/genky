import { getAccessToken } from "@/lib/api";
import { apiUrl } from "@/lib/api-base";

export type QrSettings = {
  id: number;
  enabled: boolean;
  rotate_seconds: number;
  valid_from: string;
  valid_to: string;
  allow_check_in: boolean;
  allow_check_out: boolean;
  branch_id: number;
  branch: { id: number; name: string; address?: string | null };
  rotate_options: number[];
};

export type QrCurrent = {
  enabled: boolean;
  branch: { id: number; name: string };
  rotate_seconds: number;
  expires_in: number;
  expires_at: string;
  updated_at: string;
  qr_value: string;
  payload: {
    v: number;
    org_id: number;
    branch_id: number;
    slot: number;
    token: string;
    type: string;
  };
  allow_check_in: boolean;
  allow_check_out: boolean;
  valid_from: string;
  valid_to: string;
  within_hours: boolean;
};

export type QrHistoryRow = {
  id: string;
  employee_id: number;
  full_name: string;
  avatar: string | null;
  position?: string | null;
  shift_label: string;
  action: "check_in" | "check_out" | string;
  action_label: string;
  time: string;
  ok: boolean;
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

export async function fetchQrSettings(branchId?: number): Promise<QrSettings> {
  const q = new URLSearchParams();
  if (branchId) q.set("branch_id", String(branchId));
  const res = await fetch(`${apiUrl()}/attendances/qr/settings?${q}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as QrSettings;
}

export async function updateQrSettings(payload: {
  branch_id: number;
  enabled: boolean;
  rotate_seconds: number;
  valid_from: string;
  valid_to: string;
  allow_check_in: boolean;
  allow_check_out: boolean;
}): Promise<QrSettings> {
  const res = await fetch(`${apiUrl()}/attendances/qr/settings`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as QrSettings;
}

export async function fetchQrCurrent(branchId?: number): Promise<QrCurrent> {
  const q = new URLSearchParams();
  if (branchId) q.set("branch_id", String(branchId));
  const res = await fetch(`${apiUrl()}/attendances/qr/current?${q}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as QrCurrent;
}

export async function fetchQrRecent(
  branchId?: number,
  limit = 8,
): Promise<QrHistoryRow[]> {
  const q = new URLSearchParams();
  if (branchId) q.set("branch_id", String(branchId));
  q.set("limit", String(limit));
  const res = await fetch(`${apiUrl()}/attendances/qr/recent?${q}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return (json.data ?? []) as QrHistoryRow[];
}

export type QrScanPayload = {
  v?: number;
  org_id?: number;
  branch_id: number;
  slot: number;
  token: string;
  type?: string;
};

export type QrScanResult = {
  action: "check_in" | "check_out" | string;
  data: import("@/lib/attendance-api").AttendanceRow;
};

export function parseQrScanValue(raw: string): QrScanPayload {
  const text = raw.trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Mã QR không đúng định dạng Genky.");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Mã QR không hợp lệ.");
  }
  const obj = parsed as Record<string, unknown>;
  const branch_id = Number(obj.branch_id);
  const slot = Number(obj.slot);
  const token = String(obj.token ?? "");
  if (!branch_id || Number.isNaN(slot) || token.length !== 64) {
    throw new Error("Mã QR thiếu thông tin chi nhánh hoặc token.");
  }
  return {
    v: typeof obj.v === "number" ? obj.v : undefined,
    org_id: typeof obj.org_id === "number" ? obj.org_id : undefined,
    branch_id,
    slot,
    token,
    type: typeof obj.type === "string" ? obj.type : undefined,
  };
}

export async function scanAttendanceQr(payload: {
  employee_id: number;
  branch_id: number;
  slot: number;
  token: string;
  action?: "auto" | "check_in" | "check_out";
  latitude?: number;
  longitude?: number;
  device?: string;
}): Promise<QrScanResult> {
  const res = await fetch(`${apiUrl()}/attendances/qr/scan`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ action: "auto", ...payload }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<QrScanResult>;
}
