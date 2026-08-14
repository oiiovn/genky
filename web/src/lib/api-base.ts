function isLoopbackHost(value: string): boolean {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/.test(value);
}

function apexHost(hostname: string): string {
  return hostname.replace(/^www\./, "");
}

function liveApiUrl(hostname: string): string {
  return `https://api.${apexHost(hostname)}/api`;
}

export function apiUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL ?? "")
    .trim()
    .replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (!isLoopbackHost(host)) {
      const live = liveApiUrl(host);

      if (!configured || isLoopbackHost(configured)) {
        return live;
      }

      try {
        const parsed = new URL(configured);
        if (
          parsed.hostname === host ||
          parsed.hostname === apexHost(host) ||
          parsed.hostname === `www.${apexHost(host)}`
        ) {
          return live;
        }
        if (parsed.protocol === "http:") {
          parsed.protocol = "https:";
          return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "");
        }
      } catch {
        return live;
      }

      return configured;
    }
  }

  return configured || "http://127.0.0.1:8000/api";
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
    return "Không kết nối được máy chủ. Mở https://genky.vn trên Safari (không dùng http).";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Có lỗi xảy ra, vui lòng thử lại.";
}
