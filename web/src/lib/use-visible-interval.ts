"use client";

import { useEffect } from "react";

/** Chạy interval khi tab đang hiện; dừng khi ẩn; gọi lại ngay lúc quay lại. */
export function useVisibleInterval(
  callback: () => void,
  ms: number,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;

    let timer: number | null = null;

    const stop = () => {
      if (timer == null) return;
      window.clearInterval(timer);
      timer = null;
    };

    const start = () => {
      if (timer != null) return;
      timer = window.setInterval(() => {
        if (document.visibilityState === "visible") {
          callback();
        }
      }, ms);
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        callback();
        start();
        return;
      }
      stop();
    };

    if (document.visibilityState === "visible") {
      start();
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [callback, enabled, ms]);
}
