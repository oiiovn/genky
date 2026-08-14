import { getAccessToken } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000/api";

export type WeekStart = "monday" | "sunday";
export type DateFormat = "d/m/Y" | "Y-m-d" | "m/d/Y";
export type CurrencyCode = "VND" | "USD";
export type LanguageCode = "vi" | "en";

export type GeneralSettings = {
  work_hours_per_day: number;
  week_start: WeekStart;
  date_format: DateFormat;
  currency: CurrencyCode;
  language: LanguageCode;
};

export type GeneralCompanySummary = {
  name: string;
  tax_code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  has_logo: boolean;
};

export type GeneralBackupInfo = {
  last_at: string | null;
  last_label: string | null;
  size_bytes: number;
  size_label: string | null;
};

export type GeneralStatusItem = {
  label: string;
  ok: boolean;
  percent?: number;
};

export type GeneralOverview = {
  can_manage: boolean;
  general: GeneralSettings;
  company: GeneralCompanySummary;
  backup: GeneralBackupInfo;
  system: {
    server: GeneralStatusItem;
    database: GeneralStatusItem;
    memory: GeneralStatusItem;
    disk: GeneralStatusItem;
  };
  users: {
    total: number;
    active: number;
    locked: number;
    unverified: number;
  };
  version: {
    product: string;
    version: string;
    label: string;
    latest: boolean;
    released_label: string;
    developer: string;
  };
};

export const DEFAULT_GENERAL: GeneralSettings = {
  work_hours_per_day: 8,
  week_start: "monday",
  date_format: "d/m/Y",
  currency: "VND",
  language: "vi",
};

export const WEEK_START_OPTIONS: { value: WeekStart; label: string }[] = [
  { value: "monday", label: "Thứ 2" },
  { value: "sunday", label: "Chủ nhật" },
];

export const DATE_FORMAT_OPTIONS: { value: DateFormat; label: string }[] = [
  { value: "d/m/Y", label: "dd/mm/yyyy" },
  { value: "Y-m-d", label: "yyyy-mm-dd" },
  { value: "m/d/Y", label: "mm/dd/yyyy" },
];

export const CURRENCY_OPTIONS: { value: CurrencyCode; label: string }[] = [
  { value: "VND", label: "VND (₫)" },
  { value: "USD", label: "USD ($)" },
];

export const LANGUAGE_OPTIONS: { value: LanguageCode; label: string }[] = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
];

export function labelWeekStart(v: WeekStart) {
  return WEEK_START_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function labelDateFormat(v: DateFormat) {
  return DATE_FORMAT_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function labelCurrency(v: CurrencyCode) {
  return CURRENCY_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function labelLanguage(v: LanguageCode) {
  return LANGUAGE_OPTIONS.find((o) => o.value === v)?.label ?? v;
}

export function labelWorkHours(hours: number) {
  return `${hours} giờ/ngày`;
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

export async function fetchGeneralOverview(): Promise<GeneralOverview> {
  const res = await fetch(`${API_URL}/settings/general`, {
    headers: authHeaders(false),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()) as GeneralOverview;
}

export async function updateGeneralSettings(
  payload: GeneralSettings,
): Promise<GeneralSettings> {
  const res = await fetch(`${API_URL}/settings/general`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.general as GeneralSettings;
}

export async function createGeneralBackup(): Promise<GeneralBackupInfo> {
  const res = await fetch(`${API_URL}/settings/general/backup`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const json = await res.json();
  return json.backup as GeneralBackupInfo;
}
