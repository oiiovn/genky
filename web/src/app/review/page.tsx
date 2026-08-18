"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ReviewLandingPage } from "@/components/marketing/ReviewLandingPage";
import {
  defaultReviewBoostSettings,
  loadReviewBoostSettings,
  readReviewLandingPreviewDraft,
  type ReviewBoostFullSettings,
} from "@/lib/review-boost-settings";

function ReviewLandingClient() {
  const search = useSearchParams();
  const preview = search.get("preview") === "1";
  const org = search.get("org") || "org";
  const [settings, setSettings] = useState<ReviewBoostFullSettings>(
    defaultReviewBoostSettings,
  );

  useEffect(() => {
    if (preview) {
      const draft = readReviewLandingPreviewDraft(org);
      if (draft) {
        setSettings(draft);
        return;
      }
    }
    try {
      setSettings(loadReviewBoostSettings(org));
    } catch {
      setSettings(defaultReviewBoostSettings());
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
