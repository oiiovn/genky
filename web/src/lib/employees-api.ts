import type { Branch } from "@/lib/api";
import { getAccessToken } from "@/lib/api";
import { apiUrl } from "@/lib/api-base";

export type EmployeeRole = {
  id: number;
  name: string;
  slug?: string;
  color?: string;
  bg?: string;
} | null;

export type EmployeePosition = { id: number; name: string } | null;

export type EmployeeBranchRef = {
  id: number;
  name: string;
  is_primary: boolean;
  assigned_at?: string | null;
};

export type Employee = {
  id: number;
  employee_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar: string | null;
  gender: string | null;
  date_of_birth: string | null;
  address: string | null;
  role: EmployeeRole;
  position: EmployeePosition;
  employment_type: string;
  salary_type: string;
  salary_amount: number;
  joined_at: string | null;
  resigned_at: string | null;
  status: "active" | "inactive" | "resigned" | string;
  user_id: number | null;
  has_user_account: boolean;
  branches: EmployeeBranchRef[];
};

export type Position = {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

export type EmployeeListMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export type EmployeeListResponse = {
  data: Employee[];
  meta: EmployeeListMeta;
};

export type EmployeeFilters = {
  branch_id?: number | "";
  role_id?: number | "";
  position_id?: number | "";
  status?: string;
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

export async function fetchEmployees(
  filters: EmployeeFilters = {},
): Promise<EmployeeListResponse> {
  const params = new URLSearchParams();
  if (filters.branch_id) params.set("branch_id", String(filters.branch_id));
  if (filters.role_id) params.set("role_id", String(filters.role_id));
  if (filters.position_id) params.set("position_id", String(filters.position_id));
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  if (filters.page) params.set("page", String(filters.page));
  params.set("per_page", String(filters.per_page ?? 10));

  const res = await fetch(`${apiUrl()}/employees?${params.toString()}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchPositions(): Promise<Position[]> {
  const res = await fetch(`${apiUrl()}/positions?active_only=1`, {
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return (json.data ?? []) as Position[];
}

export async function createEmployee(payload: {
  full_name: string;
  phone?: string;
  email?: string;
  role_id?: number | null;
  position_id?: number | null;
  branch_ids?: number[];
  primary_branch_id?: number;
  status?: string;
  employment_type?: string;
  salary_type?: string;
  salary_amount?: number;
  joined_at?: string;
}): Promise<Employee> {
  const res = await fetch(`${apiUrl()}/employees`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as Employee;
}

export async function updateEmployee(
  id: number,
  payload: Record<string, unknown>,
): Promise<Employee> {
  const res = await fetch(`${apiUrl()}/employees/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as Employee;
}

export async function deleteEmployee(id: number): Promise<void> {
  const res = await fetch(`${apiUrl()}/employees/${id}`, {
    method: "DELETE",
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export type InviteResult = {
  id: number;
  employee_id: number;
  email: string;
  token: string;
  expires_at: string | null;
  invite_url: string;
};

export async function inviteEmployee(
  id: number,
  email?: string,
): Promise<InviteResult> {
  const res = await fetch(`${apiUrl()}/employees/${id}/invite`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(email ? { email } : {}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  const data = json.data as InviteResult;
  return {
    ...data,
    invite_url: publicInviteUrl(data),
  };
}

export function publicInviteUrl(invite: Pick<InviteResult, "invite_url" | "token">): string {
  const fallback = `/invite/${invite.token}`;
  if (typeof window === "undefined") {
    return invite.invite_url || fallback;
  }
  try {
    const parsed = new URL(invite.invite_url, window.location.origin);
    if (["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
      return `${window.location.origin}/invite/${invite.token}`;
    }
    return parsed.toString();
  } catch {
    return `${window.location.origin}${fallback}`;
  }
}

export type InvitationPreview = {
  email: string;
  expires_at: string | null;
  is_valid: boolean;
  accepted: boolean;
  employee: { full_name: string; employee_code: string } | null;
  organization: { id: number; name: string } | null;
};

export async function fetchInvitation(
  token: string,
): Promise<InvitationPreview> {
  const res = await fetch(`${apiUrl()}/invitations/${token}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as InvitationPreview;
}

export async function acceptInvitation(
  token: string,
  payload: {
    password: string;
    password_confirmation: string;
    name?: string;
    phone?: string;
  },
): Promise<{
  access_token: string;
  refresh_token: string;
  user: { id: number; name: string; email: string };
  role: string;
}> {
  const res = await fetch(`${apiUrl()}/invitations/${token}/accept`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export type { Branch };
