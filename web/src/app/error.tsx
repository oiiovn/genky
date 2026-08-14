"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F3F4F6] px-4 text-center">
      <h1 className="text-lg font-semibold text-slate-800">Đã xảy ra lỗi</h1>
      <p className="max-w-md text-sm text-slate-500">
        {error.message || "Không thể hiển thị trang. Thử tải lại."}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white"
        >
          Thử lại
        </button>
        <Link
          href="/dashboard"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          Về tổng quan
        </Link>
      </div>
    </div>
  );
}
