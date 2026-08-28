"use client";

import clsx from "clsx";
import { CalendarDays, Plus, TrendingDown } from "lucide-react";
import type { Branch } from "@/lib/api";
import type { ReviewBoostOverviewData } from "@/lib/review-boost-types";
import { ReviewBoostOverview } from "@/components/marketing/ReviewBoostOverview";
import { ReviewBoostSettingsPanel } from "@/components/marketing/ReviewBoostSettingsPanel";
import {
  ReviewBoostHistoryPanel,
  ReviewBoostReviewsPanel,
} from "@/components/marketing/ReviewBoostTabPanels";

export type MarketingReviewsTab =
  | "overview"
  | "reviews"
  | "history"
  | "settings";

const TABS: { id: MarketingReviewsTab; label: string }[] = [
  { id: "overview", label: "Tổng quan" },
  { id: "reviews", label: "Đánh giá 5★" },
  { id: "history", label: "Lịch sử đổi quà" },
  { id: "settings", label: "Cài đặt" },
];

function labelVi(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function MobileMarketingReviews({
  orgId,
  tab,
  branches,
  branchId,
  range,
  overview,
  overviewLoading,
  overviewError,
  qrValue,
  refreshTick,
  onTabChange,
  onBranchChange,
  onRangeChange,
  onAdd,
  onOverviewChanged,
  onToast,
  onSavedUrl,
}: {
  orgId: string;
  tab: MarketingReviewsTab;
  branches: Branch[];
  branchId: number | "";
  range: { from: string; to: string };
  overview: ReviewBoostOverviewData;
  overviewLoading?: boolean;
  overviewError?: string | null;
  qrValue: string;
  refreshTick: number;
  onTabChange: (tab: MarketingReviewsTab) => void;
  onBranchChange: (id: number | "") => void;
  onRangeChange: (next: { from: string; to: string }) => void;
  onAdd: () => void;
  onOverviewChanged: () => void;
  onToast: (message: string) => void;
  onSavedUrl: (url: string) => void;
}) {
  return (
    <main className="space-y-3.5 px-3.5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="flex items-center gap-1.5 text-[22px] leading-tight font-bold text-slate-900">
            Gia tăng đánh giá
            <TrendingDown className="h-4 w-4 text-rose-500" />
          </h1>
          <p className="mt-1 text-[12px] leading-snug text-slate-400">
            Tăng đánh giá 5★ và biến khách hàng thành khách quay lại.
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-gradient-to-r from-orange-500 to-amber-400 px-3 py-2.5 text-[12px] font-semibold text-white shadow-sm shadow-orange-200"
        >
          <Plus className="h-4 w-4" />
          Thêm đánh giá
        </button>
      </div>

      <div className="-mx-3.5 overflow-x-auto border-b border-slate-200 px-3.5">
        <div className="flex w-max gap-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTabChange(t.id)}
              className={clsx(
                "relative -mb-px px-3 py-2.5 text-[13px] font-semibold whitespace-nowrap transition",
                tab === t.id ? "text-[#2B63E1]" : "text-slate-500",
              )}
            >
              {t.label}
              {tab === t.id ? (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#2B63E1]" />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {(tab === "overview" || tab === "reviews" || tab === "history") && (
        <div className="space-y-2.5">
          <div>
            <p className="mb-1.5 text-[11px] font-medium text-slate-400">
              Chi nhánh
            </p>
            <div className="-mx-0.5 flex gap-1.5 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => onBranchChange("")}
                className={clsx(
                  "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold",
                  branchId === ""
                    ? "bg-[#2B63E1] text-white"
                    : "bg-white text-slate-600 ring-1 ring-slate-200",
                )}
              >
                Tất cả
              </button>
              {branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onBranchChange(b.id)}
                  className={clsx(
                    "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold",
                    branchId === b.id
                      ? "bg-[#2B63E1] text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200",
                  )}
                >
                  {b.name}
                </button>
              ))}
            </div>
          </div>

          {tab === "overview" || tab === "history" ? (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <span className="text-[11px] text-slate-400">Từ</span>
                <input
                  type="date"
                  value={range.from}
                  onChange={(e) =>
                    onRangeChange({
                      from: e.target.value || range.from,
                      to: range.to,
                    })
                  }
                  className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-slate-800 outline-none"
                />
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <span className="text-[11px] text-slate-400">Đến</span>
                <input
                  type="date"
                  value={range.to}
                  onChange={(e) =>
                    onRangeChange({
                      from: range.from,
                      to: e.target.value || range.to,
                    })
                  }
                  className="min-w-0 flex-1 bg-transparent text-[12px] font-medium text-slate-800 outline-none"
                />
                <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </label>
            </div>
          ) : null}

          {tab === "overview" ? (
            <p className="text-[11px] text-slate-400">
              {labelVi(range.from)} – {labelVi(range.to)}
            </p>
          ) : null}
        </div>
      )}

      {tab === "overview" && overviewError ? (
        <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {overviewError}
        </p>
      ) : null}

      {tab === "overview" ? (
        overviewLoading ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-2xl bg-slate-100"
                />
              ))}
            </div>
            <div className="h-48 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        ) : (
          <div className="[&_.grid]:gap-3 [&_section]:p-3.5 [&_h3]:text-[14px]">
            <ReviewBoostOverview
              data={overview}
              qrValue={qrValue}
              onSeeAllReviews={() => onTabChange("reviews")}
            />
          </div>
        )
      ) : null}

      {tab === "reviews" ? (
        <ReviewBoostReviewsPanel
          branches={branches}
          branchId={branchId}
          refreshTick={refreshTick}
          onChanged={onOverviewChanged}
          onToast={onToast}
        />
      ) : null}

      {tab === "history" ? (
        <ReviewBoostHistoryPanel
          branches={branches}
          branchId={branchId}
          from={range.from}
          to={range.to}
          refreshTick={refreshTick}
          onToast={onToast}
        />
      ) : null}

      {tab === "settings" ? (
        <ReviewBoostSettingsPanel
          orgId={orgId}
          branches={branches}
          branchId={branchId}
          onSaved={onSavedUrl}
        />
      ) : null}
    </main>
  );
}
