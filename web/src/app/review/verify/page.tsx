"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ReviewLandingPage } from "@/components/marketing/ReviewLandingPage";
import { defaultReviewBoostSettings } from "@/lib/review-boost-settings";

function ReviewVerifyLandingRoute() {
  const search = useSearchParams();
  const token = search.get("token") || search.get("campaign_token") || "";

  return (
    <ReviewLandingPage
      settings={defaultReviewBoostSettings()}
      qrToken={token}
    />
  );
}

export default function ReviewVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Đang tải…
        </div>
      }
    >
      <ReviewVerifyLandingRoute />
    </Suspense>
  );
}
