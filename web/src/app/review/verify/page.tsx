"use client";

import { Suspense } from "react";
import ReviewVerifyClient from "./ReviewVerifyClient";

export default function ReviewVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Đang tải…
        </div>
      }
    >
      <ReviewVerifyClient />
    </Suspense>
  );
}
