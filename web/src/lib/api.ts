import type { DashboardData } from "@/types/dashboard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  current_organization_id: number | null;
  avatar_url?: string | null;
  has_avatar?: boolean;
};

export type AuthSession = {
  id: number;
  name: string;
  detail: string;
  kind: "desktop" | "phone" | "tablet" | string;
  location: string;
  time: string;
  current: boolean;
};

export type LoginHistoryRow = {
  id: number;
  time: string;
  device: string;
  location: string;
  ok: boolean;
};

export type OrganizationDocument = {
  id: number;
  name: string;
  size_label: string;
  mime?: string | null;
  created_at?: string | null;
};

export type AuthOrganization = {
  id: number;
  name: string;
  slug: string;
  phone?: string | null;
  address?: string | null;
  tax_code?: string | null;
  company_type?: string | null;
  company_size?: string | null;
  email?: string | null;
  website?: string | null;
  fax?: string | null;
  hotline?: string | null;
  representative?: string | null;
  representative_title?: string | null;
  established_at?: string | null;
  industry?: string | null;
  intro?: string | null;
  logo_url?: string | null;
  documents?: OrganizationDocument[];
  owner_id: number | null;
  timezone: string;
  locale: string;
  setup_completed_at?: string | null;
};

export type SetupInfo = {
  has_organization_profile: boolean;
  has_branch: boolean;
  branches_count: number;
  setup_completed: boolean;
  next_step: "organization" | "branch" | "dashboard";
};

export type AuthResponse = {
  token_type: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at?: string;
  refresh_token_expires_at?: string;
  user: AuthUser;
  organization: AuthOrganization;
  role: string;
};

export type MeResponse = {
  user: AuthUser;
  organization: AuthOrganization | null;
  role: string | null;
  setup: SetupInfo | null;
  access?: {
    role_label: string;
    membership_role: string | null;
    is_owner: boolean;
    employee_id?: number | null;
    employee?: {
      id: number;
      employee_code: string;
      full_name: string;
      branches: { id: number; name: string; is_primary: boolean }[];
    } | null;
    custom_role: {
      id: number;
      slug: string;
      name: string;
      is_default: boolean;
    } | null;
    permissions: Record<
      string,
      {
        view: boolean;
        create: boolean;
        update: boolean;
        delete: boolean;
        export: boolean;
      }
    >;
  } | null;
  interface?: {
    theme_preset: string;
    primary_color: string;
    secondary_color: string;
    display_mode: string;
    sidebar_style: string;
    rounded_corners: boolean;
    animations_enabled: boolean;
  };
  preferences?: {
    sidebar_style: "expanded" | "collapsed" | null;
  };
  organizations: Array<AuthOrganization & { role: string; is_default: boolean }>;
};

export type Branch = {
  id: number;
  organization_id: number;
  name: string;
  phone: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  check_in_radius_meters: number;
  is_active: boolean;
  is_headquarters: boolean;
};

export type OnboardingStatus = SetupInfo & {
  organization_id: number;
  organization: AuthOrganization;
  role: string | null;
};

const ACCESS_KEY = "genky_access_token";
const REFRESH_KEY = "genky_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function saveTokens(access: string, refresh: string) {
  localStorage.setItem(ACCESS_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) {
        clearTokens();
        return false;
      }
      const json = (await res.json()) as AuthResponse;
      saveTokens(json.access_token, json.refresh_token);
      return true;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const json =
    typeof init.body === "string" ||
    (init.body !== undefined && !(init.body instanceof FormData));
  const extra = { ...(init.headers as Record<string, string> | undefined) };
  delete extra?.Authorization;

  const res = await fetch(url, {
    ...init,
    headers: { ...authHeaders(json), ...extra },
  });
  if (res.status !== 401) return res;
  if (!(await refreshAccessToken())) return res;
  return fetch(url, {
    ...init,
    headers: { ...authHeaders(json), ...extra },
  });
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

function authHeaders(json = true): HeadersInit {
  const access = getAccessToken();
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(access ? { Authorization: `Bearer ${access}` } : {}),
  };
}

export async function register(payload: {
  name: string;
  email: string;
  phone?: string;
  password: string;
  password_confirmation: string;
  organization_name: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function login(payload: {
  login: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function logout(): Promise<void> {
  const access = getAccessToken();
  const refresh = getRefreshToken();

  try {
    if (access) {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: JSON.stringify(
          refresh ? { refresh_token: refresh } : {},
        ),
      });
    }
  } catch {
    /* vẫn xóa token local dù API lỗi / offline */
  } finally {
    clearTokens();
  }
}

export async function me(): Promise<MeResponse> {
  const access = getAccessToken();
  if (!access) throw new Error("Chưa đăng nhập.");

  const res = await authFetch(`${API_URL}/me`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function updateProfile(payload: {
  name: string;
  phone?: string | null;
}): Promise<AuthUser> {
  const res = await fetch(`${API_URL}/me`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.user as AuthUser;
}

export async function changePassword(payload: {
  current_password: string;
  password: string;
  password_confirmation: string;
}): Promise<void> {
  const res = await fetch(`${API_URL}/auth/password`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function logoutOtherDevices(): Promise<void> {
  const res = await fetch(`${API_URL}/auth/logout-others`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ refresh_token: getRefreshToken() }),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export async function logoutAllDevices(): Promise<void> {
  const access = getAccessToken();
  try {
    if (access) {
      await fetch(`${API_URL}/auth/logout-all`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${access}`,
        },
        body: "{}",
      });
    }
  } catch {
    /* ignore */
  } finally {
    clearTokens();
  }
}

export async function fetchSessions(): Promise<AuthSession[]> {
  const res = await fetch(`${API_URL}/me/sessions`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return (json.data ?? []) as AuthSession[];
}

export async function fetchLoginHistory(limit = 10): Promise<{
  data: LoginHistoryRow[];
  meta: { total: number; limit: number };
}> {
  const res = await fetch(`${API_URL}/me/login-history?limit=${limit}`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function uploadAvatar(file: File): Promise<AuthUser> {
  const access = getAccessToken();
  const body = new FormData();
  body.append("avatar", file);
  const res = await fetch(`${API_URL}/me/avatar`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
    body,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("genky-avatar"));
  }
  return json.user as AuthUser;
}

export async function fetchUserAvatarSrc(): Promise<string | null> {
  const res = await fetch(`${API_URL}/me/avatar`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const blob = await res.blob();
  if (!blob.size || blob.type.startsWith("application/json")) return null;
  return URL.createObjectURL(blob);
}

export async function getOnboardingStatus(): Promise<OnboardingStatus> {
  const res = await authFetch(`${API_URL}/onboarding/status`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function setupOrganization(payload: {
  name: string;
  phone: string;
  address: string;
}): Promise<AuthOrganization & { next_step: string }> {
  const res = await fetch(`${API_URL}/onboarding/organization`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function setupFirstBranch(payload: {
  name: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  check_in_radius_meters?: number;
}): Promise<{ branch: Branch; next_step: string }> {
  const res = await fetch(`${API_URL}/onboarding/branch`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function resolvePostAuthPath(): Promise<string> {
  const status = await getOnboardingStatus();
  if (status.next_step === "organization") return "/onboarding";
  if (status.next_step === "branch") return "/onboarding/branch";
  try {
    const profile = await me();
    if (
      profile.role === "employee" ||
      profile.access?.membership_role === "employee"
    ) {
      return "/m";
    }
  } catch {
    /* fall through */
  }
  return "/dashboard";
}

export async function fetchDashboard(): Promise<DashboardData> {
  const access = getAccessToken();
  if (!access) throw new Error("Chưa đăng nhập.");

  const res = await authFetch(`${API_URL}/dashboard`, { cache: "no-store" });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as DashboardData;
}

export async function fetchBranches(): Promise<Branch[]> {
  const res = await fetch(`${API_URL}/branches`, {
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return (json.data ?? []) as Branch[];
}

export async function fetchOrganization(): Promise<AuthOrganization> {
  const res = await fetch(`${API_URL}/organization`, {
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.organization as AuthOrganization;
}

export async function updateOrganization(payload: {
  name: string;
  phone?: string | null;
  address?: string | null;
  tax_code?: string | null;
  company_type?: string | null;
  company_size?: string | null;
  email?: string | null;
  website?: string | null;
  fax?: string | null;
  hotline?: string | null;
  representative?: string | null;
  representative_title?: string | null;
  established_at?: string | null;
  industry?: string | null;
  intro?: string | null;
}): Promise<AuthOrganization> {
  const res = await fetch(`${API_URL}/organization`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.organization as AuthOrganization;
}

export async function uploadOrganizationLogo(
  file: File,
): Promise<AuthOrganization> {
  const access = getAccessToken();
  const body = new FormData();
  body.append("logo", file);
  const res = await fetch(`${API_URL}/organization/logo`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
    body,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("genky-logo"));
  }
  return json.organization as AuthOrganization;
}

export async function fetchOrganizationLogoSrc(): Promise<string | null> {
  const res = await fetch(`${API_URL}/organization/logo`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const blob = await res.blob();
  if (!blob.size || blob.type.startsWith("application/json")) return null;
  return URL.createObjectURL(blob);
}

export async function fetchOrganizationDocuments(): Promise<
  OrganizationDocument[]
> {
  const res = await fetch(`${API_URL}/organization/documents`, {
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return (json.data ?? []) as OrganizationDocument[];
}

export async function uploadOrganizationDocument(
  file: File,
  name?: string,
): Promise<OrganizationDocument> {
  const access = getAccessToken();
  const body = new FormData();
  body.append("file", file);
  if (name) body.append("name", name);
  const res = await fetch(`${API_URL}/organization/documents`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(access ? { Authorization: `Bearer ${access}` } : {}),
    },
    body,
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.document as OrganizationDocument;
}

export async function downloadOrganizationDocument(
  id: number,
  filename: string,
): Promise<void> {
  const res = await fetch(
    `${API_URL}/organization/documents/${id}/download`,
    { headers: authHeaders(false) },
  );
  if (!res.ok) throw new Error(await parseError(res));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function deleteOrganizationDocument(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/organization/documents/${id}`, {
    method: "DELETE",
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
}

export type BranchPayload = {
  name: string;
  phone?: string | null;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  check_in_radius_meters?: number;
  is_headquarters?: boolean;
  is_active?: boolean;
};

export async function createBranch(payload: BranchPayload): Promise<Branch> {
  const res = await fetch(`${API_URL}/branches`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.branch as Branch;
}

export async function updateBranch(
  id: number,
  payload: Partial<BranchPayload>,
): Promise<Branch> {
  const res = await fetch(`${API_URL}/branches/${id}`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.branch as Branch;
}

export async function deleteBranch(id: number): Promise<void> {
  const res = await fetch(`${API_URL}/branches/${id}`, {
    method: "DELETE",
    headers: authHeaders(false),
  });
  if (!res.ok) throw new Error(await parseError(res));
}
