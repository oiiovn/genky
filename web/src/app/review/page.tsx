"use client";

import { Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { ReviewLandingPage } from "@/components/marketing/ReviewLandingPage";
import {
  defaultReviewBoostSettings,
  loadReviewBoostSettings,
  readReviewLandingPreviewDraft,
} from "@/lib/review-boost-settings";

function ReviewLandingClient() {
  const search = useSearchParams();
  const preview = search.get("preview") === "1";
  const org = search.get("org") || "org";

  const settings = useMemo(() => {
    if (preview && typeof window !== "undefined") {
      const draft = readReviewLandingPreviewDraft(org);
      if (draft) return draft;
    }
    try {
      return loadReviewBoostSettings(org);
    } catch {
      return defaultReviewBoostSettings();
    }
  }, [org, preview]);

  return <ReviewLandingPage settings={settings} preview={preview} orgId={org} />;
}

export default function ReviewLandingRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
          Đang tải…
        </div>
      }
    >
      <ReviewLandingClient />
    </Suspense>
  );
}
