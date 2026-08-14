import { getAccessToken } from "@/lib/api";
import type {
  AdjustmentCategory,
  AdjustmentRecord,
  AdjustmentStats,
  AdjustmentType,
} from "@/lib/adjustments";
import { apiUrl } from "@/lib/api-base";

export type AdjustmentPayload = {
  employee_id: number;
  type: AdjustmentType;
  category: AdjustmentCategory;
  reason: string;
  amount: number;
  date: string;
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

function normalize(row: AdjustmentRecord): AdjustmentRecord {
  return {
    ...row,
    employee_code: row.employee_code ?? "",
    full_name: row.full_name ?? "—",
    department: row.department ?? "—",
    branch_ids: row.branch_ids ?? [],
  };
}

export async function fetchAdjustments(params: {
  year: number;
  month: number;
}): Promise<{ data: AdjustmentRecord[]; stats: AdjustmentStats }> {
  const q = new URLSearchParams({
    year: String(params.year),
    month: String(params.month),
  });
  const res = await fetch(`${apiUrl()}/adjustments?${q}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return {
    data: ((json.data ?? []) as AdjustmentRecord[]).map(normalize),
    stats: json.stats as AdjustmentStats,
  };
}

export async function createAdjustment(
  payload: AdjustmentPayload,
): Promise<AdjustmentRecord> {
  const res = await fetch(`${apiUrl()}/adjustments`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return normalize(json.data as AdjustmentRecord);
}

export async function updateAdjustment(
  id: number,
  payload: AdjustmentPayload,
): Promise<AdjustmentRecord> {
  const res = await fetch(`${apiUrl()}/adjustments/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return normalize(json.data as AdjustmentRecord);
}

export async function deleteAdjustment(id: number): Promise<void> {
  const res = await fetch(`${apiUrl()}/adjustments/${id}`, {
    method: "DELETE",
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
}
