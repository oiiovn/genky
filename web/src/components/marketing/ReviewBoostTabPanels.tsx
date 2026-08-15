"use client";

import type { Branch } from "@/lib/api";
import { ReviewBoostReviewsTab } from "@/components/marketing/ReviewBoostReviewsTab";
import { ReviewBoostHistoryTab } from "@/components/marketing/ReviewBoostHistoryTab";

export function ReviewBoostReviewsPanel({
  branches,
  branchId,
  refreshTick,
  onChanged,
  onToast,
}: {
  branches: Branch[];
  branchId?: number | "";
  refreshTick?: number;
  onChanged?: () => void;
  onToast?: (message: string) => void;
}) {
  return (
    <ReviewBoostReviewsTab
      branches={branches}
      branchId={branchId}
      refreshTick={refreshTick}
      onChanged={onChanged}
      onToast={onToast}
    />
  );
}

export function ReviewBoostHistoryPanel({
  branches,
  branchId,
  dateLabel,
  refreshTick,
  onExport,
}: {
  branches: Branch[];
  branchId?: number | "";
  dateLabel: string;
  refreshTick?: number;
  onExport?: () => void;
}) {
  return (
    <ReviewBoostHistoryTab
      branches={branches}
      branchId={branchId}
      dateLabel={dateLabel}
      refreshTick={refreshTick}
      onExport={onExport}
    />
  );
}
