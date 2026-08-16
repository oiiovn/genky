import { PRODUCTION_API_URL } from "@/lib/api-base";

/** Origin của API (không kèm /api) — dùng cho /storage/... */
function apiOrigin(): string {
  if (typeof window !== "undefined" && !/localhost|127\.0\.0\.1/.test(window.location.hostname)) {
    return PRODUCTION_API_URL.replace(/\/api\/?$/, "");
  }
  const configured = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/$/, "");
  if (configured) return configured.replace(/\/api\/?$/, "");
  return PRODUCTION_API_URL.replace(/\/api\/?$/, "");
}

/** Chuẩn hoá URL ảnh từ API (absolute /storage hoặc path). */
export function resolveMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const raw = url.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/storage/") || raw.startsWith("storage/")) {
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return `${apiOrigin()}${path}`;
  }
  if (raw.startsWith("user-avatars/") || raw.startsWith("employee-avatars/")) {
    return `${apiOrigin()}/storage/${raw}`;
  }
  return raw;
}

export function employeeAvatarSrc(options: {
  avatar?: string | null;
  name?: string | null;
  code?: string | null;
}): string {
  const fromApi = resolveMediaUrl(options.avatar);
  if (fromApi) return fromApi;
  const label = (options.name || options.code || "?").trim() || "?";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(label)}&background=e0e7ff&color=4338ca`;
}
