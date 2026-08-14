function isLoopbackHost(value: string): boolean {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/.test(value);
}

/** Duy nhất một API production — web và mobile cùng gọi URL này. */
export const PRODUCTION_API_URL = "https://api.genky.vn/api";

const LOCAL_API_URL = "http://127.0.0.1:8000/api";

function normalize(url: string): string {
  return url.trim().replace(/\/$/, "");
}

export function apiUrl(): string {
  if (typeof window !== "undefined" && !isLoopbackHost(window.location.hostname)) {
    return `${window.location.origin}/backend`;
  }

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_API_URL;
  }

  const configured = normalize(process.env.NEXT_PUBLIC_API_URL ?? "");
  return configured || LOCAL_API_URL;
}

export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const message = err.message.toLowerCase();
  return (
    message === "load failed" ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("fetch failed")
  );
}

export function describeFetchError(err: unknown): string {
  if (isNetworkError(err)) {
    return "Không kết nối được máy chủ. Mở https://genky.vn rồi thử lại.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Có lỗi xảy ra, vui lòng thử lại.";
}
