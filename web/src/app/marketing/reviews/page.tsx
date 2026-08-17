"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { useAdminChrome } from "@/components/admin/AdminShell";
import { buildReviewBoostDemoOverview } from "@/lib/review-boost-demo";
import { fetchMarketingReviewOverview } from "@/lib/marketing-api";
import { loadReviewBoostSettings } from "@/lib/review-boost-settings";
import {
  isLikelyReviewUrl,
  normalizeReviewUrl,
} from "@/lib/review-boost-storage";
import type { ReviewBoostOverviewData } from "@/lib/review-boost-types";
import { AddMarketingReviewModal } from "@/components/marketing/AddMarketingReviewModal";
import { ReviewBoostSettingsPanel } from "@/components/marketing/ReviewBoostSettingsPanel";
import {
  ReviewBoostHistoryPanel,
  ReviewBoostReviewsPanel,
} from "@/components/marketing/ReviewBoostTabPanels";

const ReviewBoostOverview = dynamic(
  () =>
    import("@/components/marketing/ReviewBoostOverview").then(
      (m) => m.ReviewBoostOverview,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-2xl bg-slate-100"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    ),
  },
);

type TabId = "overview" | "reviews" | "history" | "settings";

function isoRange(days = 90): { from: string; to: string; label: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - days);
  const iso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  const fromIso = iso(from);
  const toIso = iso(to);
  return {
    from: fromIso,
    to: toIso,
    label: `${labelVi(fromIso)} – ${labelVi(toIso)}`,
  };
}

function labelVi(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

function withRange(
  from: string,
  to: string,
): { from: string; to: string; label: string } {
  const start = from <= to ? from : to;
  const end = from <= to ? to : from;
  return {
    from: start,
    to: end,
    label: `${labelVi(start)} – ${labelVi(end)}`,
  };
}

export default function MarketingReviewsPage() {
  const { branches, profile } = useAdminChrome(
    "Tăng đánh giá 5★ và biến khách hàng thành khách quay lại.",
  );
  const orgId =
    profile.organization?.id ?? profile.user.current_organization_id ?? "org";

  const [tab, setTab] = useState<TabId>("overview");
  const [branchId, setBranchId] = useState<number | "">("");
  const [range, setRange] = useState(() => isoRange(90));
  const [savedUrl, setSavedUrl] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [overviewTick, setOverviewTick] = useState(0);

  const [liveOverview, setLiveOverview] =
    useState<ReviewBoostOverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const demoOverview = useMemo(
    () => buildReviewBoostDemoOverview(branches.map((b) => b.name)),
    [branches],
  );

  useEffect(() => {
    const cfg = loadReviewBoostSettings(orgId);
    setSavedUrl(cfg.qrUrl || cfg.reviewUrl);
  }, [orgId]);

  useEffect(() => {
    const ac = new AbortController();
    setOverviewLoading(true);
    setOverviewError(null);

    void fetchMarketingReviewOverview(
      {
        branch_id: branchId,
        from: range.from,
        to: range.to,
      },
      ac.signal,
    )
      .then((data) => {
        if (!ac.signal.aborted) setLiveOverview(data);
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        setLiveOverview(null);
        setOverviewError(
          err instanceof Error ? err.message : "Không tải được tổng quan.",
        );
      })
      .finally(() => {
        if (!ac.signal.aborted) setOverviewLoading(false);
      });

    return () => ac.abort();
  }, [branchId, range.from, range.to, overviewTick]);

  const overview = liveOverview ?? demoOverview;

  const qrValue = useMemo(() => {
    const saved = normalizeReviewUrl(savedUrl);
    if (isLikelyReviewUrl(saved)) return saved;
    const path = liveOverview?.publicReviewPath ?? demoOverview.publicReviewPath;
    return path.startsWith("http") ? path : `https://${path}`;
  }, [savedUrl, liveOverview, demoOverview.publicReviewPath]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Tổng quan" },
    { id: "reviews", label: "Đánh giá 5★" },
    { id: "history", label: "Lịch sử đổi quà" },
    { id: "settings", label: "Cài đặt" },
  ];

  return (
    <main className="flex-1 overflow-y-auto bg-slate-50/80 p-5 lg:p-6">
      <div className="mx-auto max-w-[1400px] space-y-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Gia tăng đánh giá
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Tăng đánh giá 5★ và biến khách hàng thành khách quay lại.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={clsx(
                "relative -mb-px inline-flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium transition",
                tab === t.id
                  ? "border-b-2 border-blue-600 text-blue-600"
                  : "text-slate-500 hover:text-slate-800",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <span className="text-slate-400">Chi nhánh</span>
              <select
                value={branchId === "" ? "" : String(branchId)}
                onChange={(e) =>
                  setBranchId(e.target.value ? Number(e.target.value) : "")
                }
                className="bg-transparent font-medium text-slate-800 outline-none"
              >
                <option value="">Tất cả</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <span className="text-slate-400">Từ</span>
              <input
                type="date"
                value={range.from}
                onChange={(e) =>
                  setRange(withRange(e.target.value || range.from, range.to))
                }
                className="bg-transparent font-medium text-slate-800 outline-none"
              />
            </label>
            <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              <span className="text-slate-400">Đến</span>
              <input
                type="date"
                value={range.to}
                onChange={(e) =>
                  setRange(withRange(range.from, e.target.value || range.to))
                }
                className="bg-transparent font-medium text-slate-800 outline-none"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" />
            Thêm đánh giá
          </button>
        </div>

        {tab === "overview" ? (
          overviewError ? (
            <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {overviewError}
            </p>
          ) : liveOverview ? (
            <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              Tổng quan đang lấy dữ liệu thật từ API
              {branchId ? " (theo chi nhánh)" : ""}.
            </p>
          ) : overviewLoading ? (
            <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
              Đang tải tổng quan…
            </p>
          ) : null
        ) : tab === "reviews" || tab === "history" ? null : (
          <p className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Tab này vẫn dùng dữ liệu minh họa — sẽ gắn API ở bước tiếp theo.
          </p>
        )}

        {tab === "overview" ? (
          overviewLoading && !liveOverview ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-28 animate-pulse rounded-2xl bg-slate-100"
                  />
                ))}
              </div>
              <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />
            </div>
          ) : (
            <ReviewBoostOverview
              data={overview}
              qrValue={qrValue}
            />
          )
        ) : null}
        {tab === "reviews" ? (
          <ReviewBoostReviewsPanel
            branches={branches}
            branchId={branchId}
            refreshTick={overviewTick}
            onChanged={() => setOverviewTick((n) => n + 1)}
            onToast={(message) => {
              setToast(message);
              window.setTimeout(() => setToast(null), 2400);
            }}
          />
        ) : null}
        {tab === "history" ? (
          <ReviewBoostHistoryPanel
            branches={branches}
            branchId={branchId}
            from={range.from}
            to={range.to}
            dateLabel={range.label}
            refreshTick={overviewTick}
            onExport={() => {
              setToast("Xuất Excel sẽ gắn API sau.");
              window.setTimeout(() => setToast(null), 2200);
            }}
            onToast={(message) => {
              setToast(message);
              window.setTimeout(() => setToast(null), 2400);
            }}
          />
        ) : null}
        {tab === "settings" ? (
          <ReviewBoostSettingsPanel
            orgId={orgId}
            branches={branches}
            branchId={branchId}
            onSaved={setSavedUrl}
          />
        ) : null}
      </div>

      <AddMarketingReviewModal
        open={addOpen}
        branches={branches}
        preferredBranchId={branchId}
        onClose={() => setAddOpen(false)}
        onCreated={(summary) => {
          setOverviewTick((n) => n + 1);
          setToast(summary.message || "Đã lưu đánh giá.");
          window.setTimeout(() => setToast(null), 2400);
        }}
      />

      {toast ? (
        <div className="fixed right-5 bottom-5 z-50 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
