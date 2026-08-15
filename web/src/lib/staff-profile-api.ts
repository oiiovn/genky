import type { Employee } from "@/lib/employees-api";
import { getAccessToken } from "@/lib/api";
import { apiUrl } from "@/lib/api-base";

export type StaffProfileStats = {
  scans_today: number;
  attendance_month: number;
  payroll_net: number;
  payroll_month: string;
};

export type StaffProfileResponse = {
  employee: Employee & { identity_number?: string | null };
  role_label: string;
  stats: StaffProfileStats;
};

export type StaffProfileUpdate = {
  full_name?: string;
  phone?: string | null;
  gender?: "male" | "female" | "other" | null;
  date_of_birth?: string | null;
  address?: string | null;
  identity_number?: string | null;
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

export async function fetchStaffProfile(): Promise<StaffProfileResponse> {
  const res = await fetch(`${apiUrl()}/me/staff-profile`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function updateStaffProfile(
  payload: StaffProfileUpdate,
): Promise<StaffProfileResponse> {
  const res = await fetch(`${apiUrl()}/me/staff-profile`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}
