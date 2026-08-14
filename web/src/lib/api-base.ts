function isLoopbackHost(value: string): boolean {
  return /localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]/.test(value);
}

export function apiUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_API_URL ?? "")
    .trim()
    .replace(/\/$/, "");

  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const onPublicHost = !isLoopbackHost(host);

    if (onPublicHost) {
      if (!configured || isLoopbackHost(configured)) {
        return `${window.location.origin}/api`;
      }

      if (
        window.location.protocol === "https:" &&
        configured.startsWith("http://")
      ) {
        try {
          const parsed = new URL(configured);
          if (parsed.hostname === host) {
            return `https://${parsed.host}${parsed.pathname}`.replace(
              /\/$/,
              "",
            );
          }
        } catch {
          /* ignore */
        }
        return `${window.location.origin}/api`;
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
    return "Không kết nối được máy chủ. Trên điện thoại hãy mở https://genky.vn.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Có lỗi xảy ra, vui lòng thử lại.";
}
