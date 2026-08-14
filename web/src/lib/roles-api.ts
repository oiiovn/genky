import { getAccessToken } from "@/lib/api";
import type { RoleAction, RolePermissionCell } from "@/lib/roles-data";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export type RoleIcon = "crown" | "shield" | "cash" | "user" | "box";

export type ApiRole = {
  id: number;
  slug: string;
  name: string;
  description: string;
  member_count: number;
  is_default: boolean;
  is_system: boolean;
  icon: RoleIcon;
  color: string;
  bg: string;
  sort_order: number;
  permissions: Record<string, RolePermissionCell>;
};

export type RoleMember = {
  id: number;
  name: string;
  email: string | null;
};

async function parseError(res: Response): Promise<string> {
  try {
    const json = await res.json();
    if (typeof json.message === "string") return json.message;
    if (json.errors && typeof json.errors === "object") {
      const first = Object.values(json.errors as Record<string, string[]>)[0];
      if (Array.isArray(first) && first[0]) return first[0];
    }
  } catch {
    /* ignore */
  }
  return "Có lỗi xảy ra.";
}

function authHeaders(json = true): HeadersInit {
  const access = getAccessToken();
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(access ? { Authorization: `Bearer ${access}` } : {}),
  };
}

export async function fetchRoles(): Promise<ApiRole[]> {
  const res = await fetch(`${API_URL}/roles`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as ApiRole[];
}

export async function createRole(payload: {
  name: string;
  description?: string;
}): Promise<ApiRole> {
  const res = await fetch(`${API_URL}/roles`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as ApiRole;
}

export async function updateRole(
  id: number,
  payload: { name?: string; description?: string },
): Promise<ApiRole> {
  const res = await fetch(`${API_URL}/roles/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as ApiRole;
}

export async function updateRolePermissions(
  id: number,
  permissions: Record<string, RolePermissionCell>,
): Promise<ApiRole> {
  const res = await fetch(`${API_URL}/roles/${id}/permissions`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({ permissions }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as ApiRole;
}

export async function deleteRole(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/roles/${id}`, {
    method: "DELETE",
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function fetchRoleMembers(id: number): Promise<RoleMember[]> {
  const res = await fetch(`${API_URL}/roles/${id}/members`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.data as RoleMember[];
}

export type { RoleAction };
