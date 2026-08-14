import { getAccessToken } from "@/lib/api";
import { apiUrl } from "@/lib/api-base";

export type ThemeId = "purple" | "blue" | "green" | "orange" | "pink" | "slate";
export type DisplayMode = "light" | "dark";
export type SidebarStyle = "expanded" | "collapsed";

export type AppearanceSettings = {
  theme: ThemeId;
  primary: string;
  secondary: string;
  mode: DisplayMode;
  sidebar: SidebarStyle;
  rounded: boolean;
  animation: boolean;
};

export type InterfaceApiPayload = {
  theme_preset: ThemeId;
  primary_color: string;
  secondary_color: string;
  display_mode: DisplayMode;
  sidebar_style: SidebarStyle;
  rounded_corners: boolean;
  animations_enabled: boolean;
};

export const THEMES: {
  id: ThemeId;
  label: string;
  primary: string;
  secondary: string;
}[] = [
  { id: "purple", label: "Đen", primary: "#111827", secondary: "#F3F4F6" },
  { id: "blue", label: "Xanh dương", primary: "#3B82F6", secondary: "#EFF6FF" },
  { id: "green", label: "Xanh lá", primary: "#22C55E", secondary: "#ECFDF5" },
  { id: "orange", label: "Cam", primary: "#F59E0B", secondary: "#FFFBEB" },
  { id: "pink", label: "Hồng", primary: "#EC4899", secondary: "#FDF2F8" },
  { id: "slate", label: "Slate", primary: "#64748B", secondary: "#F1F5F9" },
];

export const DEFAULT_APPEARANCE: AppearanceSettings = {
  theme: "purple",
  primary: "#111827",
  secondary: "#F3F4F6",
  mode: "light",
  sidebar: "expanded",
  rounded: true,
  animation: true,
};

const KEY = "genky_appearance";

export function appearanceFromApi(row: InterfaceApiPayload): AppearanceSettings {
  return migrateLegacyPurple({
    theme: row.theme_preset,
    primary: row.primary_color,
    secondary: row.secondary_color,
    mode: row.display_mode,
    sidebar: row.sidebar_style,
    rounded: row.rounded_corners,
    animation: row.animations_enabled,
  });
}

export function appearanceToApi(settings: AppearanceSettings): InterfaceApiPayload {
  return {
    theme_preset: settings.theme,
    primary_color: settings.primary,
    secondary_color: settings.secondary,
    display_mode: settings.mode,
    sidebar_style: settings.sidebar,
    rounded_corners: settings.rounded,
    animations_enabled: settings.animation,
  };
}

export function loadAppearance(): AppearanceSettings {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_APPEARANCE;
    const parsed = { ...DEFAULT_APPEARANCE, ...JSON.parse(raw) } as AppearanceSettings;
    return migrateLegacyPurple(parsed);
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

function migrateLegacyPurple(settings: AppearanceSettings): AppearanceSettings {
  const primary = settings.primary?.toUpperCase();
  if (
    settings.theme === "purple" &&
    (primary === "#6366F1" || primary === "#4F46E5")
  ) {
    return {
      ...settings,
      primary: DEFAULT_APPEARANCE.primary,
      secondary: DEFAULT_APPEARANCE.secondary,
    };
  }
  return settings;
}

export function saveAppearance(settings: AppearanceSettings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
  applyAppearance(settings);
  window.dispatchEvent(
    new CustomEvent<AppearanceSettings>("genky-appearance", {
      detail: settings,
    }),
  );
}

function darken(hex: string, amount = 0.12): string {
  const raw = hex.replace("#", "");
  if (!/^[0-9A-Fa-f]{6}$/.test(raw)) return hex;
  const num = parseInt(raw, 16);
  const r = Math.max(0, Math.round(((num >> 16) & 255) * (1 - amount)));
  const g = Math.max(0, Math.round(((num >> 8) & 255) * (1 - amount)));
  const b = Math.max(0, Math.round((num & 255) * (1 - amount)));
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export function applyAppearance(settings: AppearanceSettings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const primary = settings.primary || DEFAULT_APPEARANCE.primary;
  const secondary = settings.secondary || DEFAULT_APPEARANCE.secondary;
  root.style.setProperty("--genky-primary", primary);
  root.style.setProperty("--genky-primary-hover", darken(primary, 0.14));
  root.style.setProperty("--genky-secondary", secondary);
  root.dataset.theme = settings.mode;
  root.dataset.sidebar = settings.sidebar;
  root.dataset.rounded = settings.rounded ? "1" : "0";
  root.dataset.motion = settings.animation ? "on" : "off";
}

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

export async function fetchInterfaceSettings(options?: {
  persist?: boolean;
}): Promise<AppearanceSettings> {
  const res = await fetch(`${apiUrl()}/settings/interface`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  const settings = appearanceFromApi(json.interface as InterfaceApiPayload);
  if (options?.persist !== false) {
    saveAppearance(settings);
  }
  return settings;
}

export async function updateInterfaceSettings(
  settings: AppearanceSettings,
): Promise<AppearanceSettings> {
  const res = await fetch(`${apiUrl()}/settings/interface`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(appearanceToApi(settings)),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  const next = appearanceFromApi(json.interface as InterfaceApiPayload);
  saveAppearance(next);
  return next;
}

export async function resetInterfaceSettings(): Promise<AppearanceSettings> {
  const res = await fetch(`${apiUrl()}/settings/interface/reset`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  const next = appearanceFromApi(json.interface as InterfaceApiPayload);
  saveAppearance(next);
  return next;
}

export type UserPreferences = {
  sidebar_style: SidebarStyle | null;
};

export async function fetchUserPreferences(): Promise<UserPreferences> {
  const res = await fetch(`${apiUrl()}/me/preferences`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.preferences as UserPreferences;
}

export async function updateUserPreferences(
  payload: Partial<UserPreferences>,
): Promise<UserPreferences> {
  const res = await fetch(`${apiUrl()}/me/preferences`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.preferences as UserPreferences;
}

export async function toggleSidebarPreference(): Promise<UserPreferences> {
  const res = await fetch(`${apiUrl()}/me/preferences/sidebar/toggle`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.preferences as UserPreferences;
}
