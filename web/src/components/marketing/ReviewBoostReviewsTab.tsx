"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  Filter,
  Gift,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import type { Branch } from "@/lib/api";
import { formatReviewCount } from "@/lib/review-boost-demo";
import {
  fetchMarketingReviewList,
  fetchMarketingRewards,
  issueMarketingReviewReward,
  rejectMarketingReview,
  verifyMarketingReview,
} from "@/lib/marketing-api";
import type {
  ReviewChannel,
  ReviewGiftStatus,
  ReviewListRow,
  ReviewListStats,
  ReviewTopCustomer,
} from "@/lib/review-boost-types";

type ListSubTab = "all" | "ungifted" | "gifted" | "rejected";

const emptyStats: ReviewListStats = {
  total: 0,
  pending: 0,
  verified: 0,
  gifted: 0,
  ungifted: 0,
  rejected: 0,
  totalDeltaPct: 0,
  pendingPct: 0,
  verifiedPct: 0,
  giftedPct: 0,
};

const channelMeta: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  shopee: { label: "Shopee", color: "text-orange-600", bg: "bg-orange-50" },
  shopee_food: {
    label: "ShopeeFood",
    color: "text-rose-600",
    bg: "bg-rose-50",
  },
  grab_food: {
    label: "GrabFood",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  other: {
    label: "Khác",
    color: "text-slate-600",
    bg: "bg-slate-50",
  },
};

function channelUi(row: ReviewListRow) {
  return (
    channelMeta[row.channel] ?? {
      label: row.channelLabel || row.channel || "Khác",
      color: "text-slate-600",
      bg: "bg-slate-50",
    }
  );
}

const giftStatusUi: Record<
  ReviewGiftStatus,
  { label: string; className: string }
> = {
  gifted: {
    label: "Đã tặng",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  ungifted: {
    label: "Chưa tặng",
    className: "bg-orange-50 text-orange-700 ring-orange-100",
  },
  pending: {
    label: "Chờ xác minh",
    className: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  rejected: {
    label: "Từ chối",
    className: "bg-rose-50 text-rose-700 ring-rose-100",
  },
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-amber-500">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={clsx(
            "h-3.5 w-3.5",
            i < Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-slate-200",
          )}
        />
      ))}
      <span className="ml-1 text-xs font-semibold text-slate-700">
        {rating.toFixed(1)}
      </span>
    </span>
  );
}

function GiftCodeCell({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!code) return <span className="text-slate-300">—</span>;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code!);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="inline-flex items-center gap-1.5 rounded-lg bg-sky-50 px-2 py-1 font-mono text-xs font-semibold text-sky-700 ring-1 ring-sky-100 ring-inset hover:bg-sky-100"
    >
      {code}
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function StatusDonut({
  gifted,
  pending,
  ungifted,
  rejected,
  total,
}: {
  gifted: number;
  pending: number;
  ungifted: number;
  rejected: number;
  total: number;
}) {
  const slices = [
    { key: "gifted", value: gifted, color: "#10B981", label: "Đã tặng" },
    { key: "pending", value: pending, color: "#F59E0B", label: "Chờ xác minh" },
    { key: "ungifted", value: ungifted, color: "#FB923C", label: "Chưa tặng" },
    { key: "rejected", value: rejected, color: "#F43F5E", label: "Từ chối" },
  ];
  const r = 36;
  const c = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div className="flex items-center gap-3">
      <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90">
        {slices.map((s) => {
          const len = total > 0 ? (s.value / total) * c : 0;
          const el = (
            <circle
              key={s.key}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="14"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
            />
          );
          offset += len;
          return el;
        })}
      </svg>
      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        {slices.map((s) => {
          const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : "0.0";
          return (
            <li key={s.key} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-slate-600">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: s.color }}
                />
                {s.label}
              </span>
              <span className="font-semibold text-slate-800">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ReviewBoostReviewsTab({
  branches,
  branchId = "",
  refreshTick = 0,
  onChanged,
  onToast,
}: {
  branches: Branch[];
  branchId?: number | "";
  refreshTick?: number;
  onChanged?: () => void;
  onToast?: (message: string) => void;
}) {
  const [listRows, setListRows] = useState<ReviewListRow[]>([]);
  const [stats, setStats] = useState<ReviewListStats>(emptyStats);
  const [topCustomers, setTopCustomers] = useState<ReviewTopCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<"" | ReviewChannel>("");
  const [status, setStatus] = useState<"" | ReviewGiftStatus>("");
  const [branch, setBranch] = useState("");
  const [subTab, setSubTab] = useState<ListSubTab>("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [modalRow, setModalRow] = useState<ReviewListRow | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setLoadError(null);
    void fetchMarketingReviewList({ branch_id: branchId }, ac.signal)
      .then((data) => {
        if (ac.signal.aborted) return;
        setListRows(data.listRows ?? []);
        setStats(data.listStats ?? emptyStats);
        setTopCustomers(data.topCustomers ?? []);
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setListRows([]);
        setStats(emptyStats);
        setTopCustomers([]);
        setLoadError(
          e instanceof Error ? e.message : "Không tải được đánh giá.",
        );
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [branchId, refreshTick]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = Array.isArray(listRows) ? listRows : [];
    return rows.filter((row) => {
      if (subTab === "ungifted" && row.giftStatus !== "ungifted") return false;
      if (subTab === "gifted" && row.giftStatus !== "gifted") return false;
      if (subTab === "rejected" && row.giftStatus !== "rejected") return false;
      if (channel && row.channel !== channel) return false;
      if (status && row.giftStatus !== status) return false;
      if (branch && row.branch !== branch) return false;
      if (!q) return true;
      const order = (row.orderCode || "").toLowerCase();
      const name = (row.customerName || "").toLowerCase();
      const phone = (row.customerPhone || "").replace(/\s/g, "");
      return (
        order.includes(q) ||
        name.includes(q) ||
        phone.includes(q.replace(/\s/g, ""))
      );
    });
  }, [listRows, search, channel, status, branch, subTab]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (safePage - 1) * perPage,
    safePage * perPage,
  );

  const subTabs: { id: ListSubTab; label: string; count: number }[] = [
    { id: "all", label: "Tất cả", count: stats.total },
    { id: "ungifted", label: "Chưa tặng", count: stats.ungifted },
    { id: "gifted", label: "Đã tặng", count: stats.gifted },
    { id: "rejected", label: "Từ chối", count: stats.rejected },
  ];

  function toggleAll(rows: ReviewListRow[]) {
    const ids = rows.map((r) => r.id);
    const allOn = ids.every((id) => selected.has(id));
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOn) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function chooseRewardId(): Promise<number | undefined> {
    try {
      const rows = (await fetchMarketingRewards()).filter((r) => r.enabled);
      if (rows.length === 0) return undefined;
      if (rows.length === 1) return rows[0].id;
      const list = rows
        .map((r, i) => `${i + 1}. ${r.name} (${r.value.toLocaleString("vi-VN")}đ)`)
        .join("\n");
      const pick = window.prompt(
        `Chọn món tặng:\n${list}\n\nNhập số thứ tự:`,
        "1",
      );
      if (!pick) return undefined;
      const idx = Math.max(1, Number(pick) || 1) - 1;
      return rows[Math.min(idx, rows.length - 1)]?.id;
    } catch {
      return undefined;
    }
  }

  async function issueRewardFor(reviewId: string) {
    const rewardId = await chooseRewardId();
    return issueMarketingReviewReward(reviewId, rewardId);
  }

  async function runAction(label: string, fn: () => Promise<unknown>) {
    setActing(true);
    try {
      await fn();
      onToast?.(label);
      setModalRow(null);
      onChanged?.();
    } catch (e: unknown) {
      onToast?.(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setActing(false);
    }
  }

  const channelOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of listRows) {
      if (!seen.has(row.channel)) {
        seen.set(row.channel, row.channelLabel || channelUi(row).label);
      }
    }
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [listRows]);

  const kpiCards = [
    {
      label: "Tổng đánh giá 5★",
      value: stats.total,
      sub: `+${stats.totalDeltaPct.toFixed(1)}%`,
      subTone: "text-emerald-500",
      icon: Star,
      iconBg: "bg-blue-500",
    },
    {
      label: "Chờ xác minh",
      value: stats.pending,
      sub: `${stats.pendingPct.toFixed(1)}%`,
      subTone: "text-slate-400",
      icon: Clock3,
      iconBg: "bg-amber-500",
    },
    {
      label: "Đã xác minh",
      value: stats.verified,
      sub: `${stats.verifiedPct.toFixed(1)}%`,
      subTone: "text-slate-400",
      icon: ShieldCheck,
      iconBg: "bg-emerald-500",
    },
    {
      label: "Đã tặng (khách đã nhận)",
      value: stats.gifted,
      sub: `${stats.giftedPct.toFixed(1)}%`,
      subTone: "text-slate-400",
      icon: Gift,
      iconBg: "bg-sky-500",
    },
  ];

  if (loading && listRows.length === 0) {
    return <div className="h-72 animate-pulse rounded-2xl bg-slate-100" />;
  }

  return (
    <div className="space-y-5">
      {loadError ? (
        <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {loadError}
        </p>
      ) : (
        <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          Đang hiển thị {stats.total} đánh giá từ API
          {branchId ? " (theo chi nhánh)" : ""}.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo mã đơn, tên khách hàng, SĐT..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-9 text-sm outline-none focus:border-blue-400 focus:bg-white"
          />
        </div>
        <select
          value={channel}
          onChange={(e) => {
            setChannel(e.target.value as "" | ReviewChannel);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
        >
          <option value="">Tất cả kênh</option>
          {channelOptions.length > 0 ? (
            channelOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))
          ) : (
            <>
              <option value="shopee_food">ShopeeFood</option>
              <option value="grab_food">GrabFood</option>
            </>
          )}
        </select>
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "" | ReviewGiftStatus);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="pending">Chờ xác minh</option>
          <option value="ungifted">Chưa tặng</option>
          <option value="gifted">Đã tặng</option>
          <option value="rejected">Từ chối</option>
        </select>
        <select
          value={branch}
          onChange={(e) => {
            setBranch(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
        >
          <option value="">Tất cả chi nhánh</option>
          {branches.map((b) => (
            <option key={b.id} value={b.name}>
              {b.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setChannel("");
            setStatus("");
            setBranch("");
            setSubTab("all");
            setPage(1);
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600"
        >
          <Filter className="h-4 w-4" />
          Xoá lọc
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpiCards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {formatReviewCount(card.value)}
                  </p>
                  <p className={clsx("mt-1 text-sm font-semibold", card.subTone)}>
                    {card.sub}
                  </p>
                </div>
                <span
                  className={clsx(
                    "flex h-10 w-10 items-center justify-center rounded-xl text-white",
                    card.iconBg,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </article>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-12">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:col-span-8">
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 px-4 pt-3">
            {subTabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSubTab(t.id);
                  setStatus("");
                  setPage(1);
                }}
                className={clsx(
                  "rounded-t-lg px-3 py-2 text-sm font-medium",
                  subTab === t.id
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-500 hover:text-slate-800",
                )}
              >
                {t.label}{" "}
                <span className="text-xs tabular-nums opacity-70">
                  ({formatReviewCount(t.count)})
                </span>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-slate-50 text-left text-[11px] tracking-wide text-slate-400 uppercase">
                <tr>
                  <th className="px-3 py-3">
                    <input
                      type="checkbox"
                      checked={
                        pageRows.length > 0 &&
                        pageRows.every((r) => selected.has(r.id))
                      }
                      onChange={() => toggleAll(pageRows)}
                      className="rounded border-slate-300"
                      aria-label="Chọn tất cả"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold">Mã đơn</th>
                  <th className="px-3 py-3 font-semibold">Khách hàng</th>
                  <th className="px-3 py-3 font-semibold">Kênh</th>
                  <th className="px-3 py-3 font-semibold">Chi nhánh</th>
                  <th className="px-3 py-3 font-semibold">Ngày đánh giá</th>
                  <th className="px-3 py-3 font-semibold">Số sao</th>
                  <th className="px-3 py-3 font-semibold">Trạng thái</th>
                  <th className="px-3 py-3 font-semibold">Mã tặng món</th>
                  <th className="px-3 py-3 font-semibold">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-4 py-14 text-center text-slate-400"
                    >
                      {stats.total === 0
                        ? "Chưa có đánh giá nào."
                        : "Không có đánh giá khớp bộ lọc."}
                    </td>
                  </tr>
                ) : (
                  pageRows.map((row) => {
                    const ch = channelUi(row);
                    const st =
                      giftStatusUi[row.giftStatus] ?? giftStatusUi.pending;
                    return (
                      <tr
                        key={row.id}
                        className="border-t border-slate-100 hover:bg-slate-50/60"
                      >
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selected.has(row.id)}
                            onChange={() => toggleOne(row.id)}
                            className="rounded border-slate-300"
                            aria-label={`Chọn ${row.orderCode}`}
                          />
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-800">
                          {row.orderCode}
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-medium text-slate-800">
                            {row.customerName}
                          </p>
                          <p className="text-xs text-slate-400">
                            {row.customerPhone}
                          </p>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={clsx(
                              "inline-flex rounded-lg px-2 py-1 text-xs font-semibold",
                              ch.bg,
                              ch.color,
                            )}
                          >
                            {ch.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {row.branch}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-slate-500">
                          {row.reviewedAt}
                        </td>
                        <td className="px-3 py-3">
                          <Stars rating={row.rating} />
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={clsx(
                              "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
                              st.className,
                            )}
                          >
                            {st.label}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <GiftCodeCell code={row.giftCode} />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setModalRow(row)}
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                              aria-label="Xem"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {row.giftStatus === "pending" ? (
                              <button
                                type="button"
                                disabled={acting}
                                onClick={() =>
                                  void runAction(
                                    "Đã xác minh đánh giá.",
                                    () => verifyMarketingReview(row.id),
                                  )
                                }
                                className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 disabled:opacity-40"
                                aria-label="Xác minh"
                                title="Xác minh"
                              >
                                <ShieldCheck className="h-4 w-4" />
                              </button>
                            ) : null}
                            {row.giftStatus === "ungifted" ? (
                              <button
                                type="button"
                                disabled={acting}
                                onClick={() =>
                                  void runAction("Đã cấp mã quà.", () =>
                                    issueRewardFor(row.id),
                                  )
                                }
                                className="rounded-lg p-1.5 text-sky-500 hover:bg-sky-50 disabled:opacity-40"
                                aria-label="Cấp mã"
                                title="Cấp mã tặng"
                              >
                                <Gift className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
            <label className="inline-flex items-center gap-2">
              Hiển thị
              <select
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-slate-700"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              dòng
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"
                aria-label="Trang trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 tabular-nums">
                {safePage} / {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className="rounded-lg border border-slate-200 p-1.5 disabled:opacity-40"
                aria-label="Trang sau"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-4 xl:col-span-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-800">Top khách hàng</h3>
            <p className="mt-1 text-[11px] text-slate-400">
              Đã tặng nhiều nhất
            </p>
            <ol className="mt-3 space-y-3">
              {topCustomers.length === 0 ? (
                <li className="text-sm text-slate-400">Chưa có dữ liệu.</li>
              ) : (
                topCustomers.map((c, i) => {
                  const medal =
                    i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                  return (
                    <li key={c.id} className="flex items-center gap-3">
                      <span className="w-5 text-sm">
                        {medal ?? (
                          <span className="text-xs font-semibold text-slate-400">
                            {i + 1}
                          </span>
                        )}
                      </span>
                      <span
                        className={clsx(
                          "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white",
                          c.tone,
                        )}
                      >
                        {c.initial}
                      </span>
                      <p className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800">
                        {c.name}
                      </p>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                        {c.giftCount} mã
                      </span>
                    </li>
                  );
                })
              )}
            </ol>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold text-slate-800">Thống kê nhanh</h3>
            <p className="mt-0.5 text-xs text-slate-400">
              {formatReviewCount(stats.total)} đánh giá
            </p>
            <div className="mt-3">
              <StatusDonut
                gifted={stats.gifted}
                pending={stats.pending}
                ungifted={stats.ungifted}
                rejected={stats.rejected}
                total={stats.total}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-900">Gợi ý</h3>
            <p className="mt-1 text-sm text-amber-800/90">
              Hãy xác minh các đánh giá đang chờ để khách hàng sớm nhận được mã
              tặng món.
            </p>
            <button
              type="button"
              onClick={() => {
                setSubTab("all");
                setStatus("pending");
                setPage(1);
              }}
              className="mt-2 text-sm font-semibold text-amber-900 hover:underline"
            >
              Lọc chờ xác minh →
            </button>
          </section>
        </aside>
      </div>

      {modalRow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setModalRow(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Chi tiết đánh giá
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {modalRow.orderCode}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalRow(null)}
                className="rounded-lg px-2 py-1 text-sm text-slate-400 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Khách hàng</dt>
                <dd className="font-medium text-slate-800">
                  {modalRow.customerName}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">SĐT</dt>
                <dd className="text-slate-800">{modalRow.customerPhone}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Kênh</dt>
                <dd className="text-slate-800">{channelUi(modalRow).label}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Chi nhánh</dt>
                <dd className="text-slate-800">{modalRow.branch}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Ngày đánh giá</dt>
                <dd className="text-slate-800">{modalRow.reviewedAt}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Số sao</dt>
                <dd>
                  <Stars rating={modalRow.rating} />
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500">Trạng thái</dt>
                <dd>
                  <span
                    className={clsx(
                      "rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset",
                      (
                        giftStatusUi[modalRow.giftStatus] ??
                        giftStatusUi.pending
                      ).className,
                    )}
                  >
                    {
                      (
                        giftStatusUi[modalRow.giftStatus] ??
                        giftStatusUi.pending
                      ).label
                    }
                  </span>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500">Mã tặng món</dt>
                <dd>
                  <GiftCodeCell code={modalRow.giftCode} />
                </dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              {modalRow.giftStatus === "pending" ? (
                <>
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() => {
                      const reason =
                        window.prompt("Lý do từ chối?", "Không hợp lệ") ?? "";
                      if (!reason.trim()) return;
                      void runAction("Đã từ chối đánh giá.", () =>
                        rejectMarketingReview(modalRow.id, reason.trim()),
                      );
                    }}
                    className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-40"
                  >
                    Từ chối
                  </button>
                  <button
                    type="button"
                    disabled={acting}
                    onClick={() =>
                      void runAction("Đã xác minh đánh giá.", () =>
                        verifyMarketingReview(modalRow.id),
                      )
                    }
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    Xác minh
                  </button>
                </>
              ) : null}
              {modalRow.giftStatus === "ungifted" ? (
                <button
                  type="button"
                  disabled={acting}
                  onClick={() =>
                    void runAction("Đã cấp mã quà.", () =>
                      issueRewardFor(modalRow.id),
                    )
                  }
                  className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  Cấp mã quà
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
