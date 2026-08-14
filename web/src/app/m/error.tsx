"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function StaffError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0B1220] px-6 text-center">
      <h1 className="text-lg font-semibold text-white">Không mở được màn hình</h1>
      <p className="max-w-sm text-sm text-slate-400">
        Thử tải lại trang. Nếu đang quét QR, hãy cấp quyền camera rồi mở lại.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-900"
        >
          Thử lại
        </button>
        <Link
          href="/m"
          className="rounded-2xl border border-white/15 px-4 py-2 text-sm font-medium text-slate-200"
        >
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
