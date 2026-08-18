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
  from,
  to,
  refreshTick,
  onToast,
}: {
  branches: Branch[];
  branchId?: number | "";
  from?: string;
  to?: string;
  refreshTick?: number;
  onToast?: (message: string) => void;
}) {
  return (
    <ReviewBoostHistoryTab
      branches={branches}
      branchId={branchId}
      from={from}
      to={to}
      refreshTick={refreshTick}
      onToast={onToast}
    />
  );
}
