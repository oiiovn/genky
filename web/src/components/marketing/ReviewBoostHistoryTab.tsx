"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  Gift,
  MoreVertical,
  Search,
  XCircle,
} from "lucide-react";
import type { Branch } from "@/lib/api";
import { formatReviewCount } from "@/lib/review-boost-demo";
import { fetchMarketingRedemptionHistory } from "@/lib/marketing-api";
import type {
  ReviewChannel,
  ReviewRedeemRow,
  ReviewRedeemStats,
  ReviewRedeemStatus,
} from "@/lib/review-boost-types";

const emptyStats: ReviewRedeemStats = {
  total: 0,
  success: 0,
  successPct: 0,
  processing: 0,
  processingPct: 0,
  failed: 0,
  failedPct: 0,
  totalValue: 0,
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

function channelUi(channel: string) {
  return (
    channelMeta[channel] ?? {
      label: channel || "Khác",
      color: "text-slate-600",
      bg: "bg-slate-50",
    }
  );
}

const statusUi: Record<
  ReviewRedeemStatus,
  { label: string; className: string }
> = {
  success: {
    label: "Đã đổi",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  processing: {
    label: "Đang xử lý",
    className: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  failed: {
    label: "Đổi không thành công",
    className: "bg-rose-50 text-rose-700 ring-rose-100",
  },
};

function formatMoney(n: number): string {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function Avatar({
  initial,
  tone,
}: {
  initial: string;
  tone: string;
}) {
  return (
    <span
      className={clsx(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white",
        tone,
      )}
    >
      {initial}
    </span>
  );
}

export function ReviewBoostHistoryTab({
  branches,
  branchId = "",
  dateLabel,
  refreshTick = 0,
  onExport,
}: {
  branches: Branch[];
  branchId?: number | "";
  dateLabel: string;
  refreshTick?: number;
  onExport?: () => void;
}) {
  const [stats, setStats] = useState<ReviewRedeemStats>(emptyStats);
  const [redeemRows, setRedeemRows] = useState<ReviewRedeemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rangeLabel, setRangeLabel] = useState(dateLabel);

  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [channel, setChannel] = useState<"" | ReviewChannel>("");
  const [status, setStatus] = useState<"" | ReviewRedeemStatus>("");
  const [staff, setStaff] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setLoadError(null);
    void fetchMarketingRedemptionHistory({ branch_id: branchId }, ac.signal)
      .then((data) => {
        if (ac.signal.aborted) return;
        setStats(data.redeemStats ?? emptyStats);
        setRedeemRows(data.redeemRows ?? []);
        if (data.from && data.to) {
          const fmt = (iso: string) => {
            const [y, m, d] = iso.split("-");
            return `${d}/${m}/${y}`;
          };
          setRangeLabel(`${fmt(data.from)} – ${fmt(data.to)}`);
        } else {
          setRangeLabel(dateLabel);
        }
      })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setStats(emptyStats);
        setRedeemRows([]);
        setLoadError(
          e instanceof Error ? e.message : "Không tải được lịch sử đổi quà.",
        );
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [branchId, refreshTick, dateLabel]);

  const staffOptions = useMemo(
    () =>
      [
        ...new Set(
          redeemRows.map((r) => r.staffName).filter((n) => n && n !== "—"),
        ),
      ],
    [redeemRows],
  );

  const channelOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const row of redeemRows) {
      if (!seen.has(row.channel)) {
        seen.set(row.channel, channelUi(row.channel).label);
      }
    }
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [redeemRows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = Array.isArray(redeemRows) ? redeemRows : [];
    return rows.filter((row) => {
      if (branch && row.branch !== branch) return false;
      if (channel && row.channel !== channel) return false;
      if (status && row.status !== status) return false;
      if (staff && row.staffName !== staff) return false;
      if (!q) return true;
      const phone = (row.customerPhone || "").replace(/\s/g, "");
      return (
        (row.giftCode || "").toLowerCase().includes(q) ||
        (row.orderCode || "").toLowerCase().includes(q) ||
        (row.customerName || "").toLowerCase().includes(q) ||
        phone.includes(q.replace(/\s/g, ""))
      );
    });
  }, [redeemRows, search, branch, channel, status, staff]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / perPage));
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (safePage - 1) * perPage,
    safePage * perPage,
  );

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const kpis = [
    {
      label: "Tổng lượt đổi quà",
      value: formatReviewCount(stats.total),
      sub: "Quà đã ghi nhận trong kỳ",
      icon: Gift,
      iconBg: "bg-violet-500",
    },
    {
      label: "Đã đổi thành công",
      value: formatReviewCount(stats.success),
      sub: `${stats.successPct.toFixed(1)}%`,
      icon: CheckCircle2,
      iconBg: "bg-emerald-500",
    },
    {
      label: "Đang xử lý",
      value: formatReviewCount(stats.processing),
      sub: `${stats.processingPct.toFixed(1)}%`,
      icon: Clock3,
      iconBg: "bg-amber-500",
    },
    {
      label: "Đổi không thành công",
      value: formatReviewCount(stats.failed),
      sub: `${stats.failedPct.toFixed(1)}%`,
      icon: XCircle,
      iconBg: "bg-rose-500",
    },
    {
      label: "Tổng giá trị quà tặng",
      value: formatMoney(stats.totalValue),
      sub: "Theo giá vốn",
      icon: CalendarDays,
      iconBg: "bg-indigo-500",
    },
  ];

  if (loading && redeemRows.length === 0) {
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
          Đang hiển thị {stats.total} lượt đổi quà từ API
          {branchId ? " (theo chi nhánh)" : ""}.
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {rangeLabel}
          </div>
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Xuất Excel
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Tìm mã quà, mã đơn, tên khách hàng, SĐT..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-9 text-sm outline-none focus:border-blue-400 focus:bg-white"
            />
          </div>
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
              setStatus(e.target.value as "" | ReviewRedeemStatus);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="success">Đã đổi</option>
            <option value="processing">Đang xử lý</option>
            <option value="failed">Đổi không thành công</option>
          </select>
          <select
            value={staff}
            onChange={(e) => {
              setStaff(e.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none"
          >
            <option value="">Tất cả nhân viên</option>
            {staffOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setBranch("");
              setChannel("");
              setStatus("");
              setStaff("");
              setPage(1);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600"
          >
            <Filter className="h-4 w-4" />
            Xoá lọc
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm text-slate-500">{card.label}</p>
                  <p className="mt-1 truncate text-xl font-bold text-slate-900">
                    {card.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">{card.sub}</p>
                </div>
                <span
                  className={clsx(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white",
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

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-slate-50 text-left text-[11px] tracking-wide text-slate-400 uppercase">
              <tr>
                <th className="w-10 px-3 py-3" />
                <th className="px-3 py-3 font-semibold">Mã quà tặng</th>
                <th className="px-3 py-3 font-semibold">Mã đơn hàng</th>
                <th className="px-3 py-3 font-semibold">Khách hàng</th>
                <th className="px-3 py-3 font-semibold">Kênh</th>
                <th className="px-3 py-3 font-semibold">Chi nhánh</th>
                <th className="px-3 py-3 font-semibold">Món tặng</th>
                <th className="px-3 py-3 font-semibold">Thời gian đổi</th>
                <th className="px-3 py-3 font-semibold">Nhân viên xác nhận</th>
                <th className="px-3 py-3 font-semibold">Trạng thái</th>
                <th className="px-3 py-3 font-semibold">Ghi chú</th>
                <th className="px-3 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-4 py-14 text-center text-slate-400"
                  >
                    {stats.total === 0
                      ? "Chưa có lượt đổi quà nào."
                      : "Không có lượt đổi quà khớp bộ lọc."}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <RedeemRow
                    key={row.id}
                    row={row}
                    open={expanded.has(row.id)}
                    onToggle={() => toggleExpand(row.id)}
                  />
                ))
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
    </div>
  );
}

function RedeemRow({
  row,
  open,
  onToggle,
}: {
  row: ReviewRedeemRow;
  open: boolean;
  onToggle: () => void;
}) {
  const ch = channelUi(row.channel);
  const st = statusUi[row.status] ?? statusUi.success;
  const tones = [
    "bg-blue-500",
    "bg-violet-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-rose-500",
  ];
  const tone =
    tones[(row.customerName || "").length % tones.length] ?? "bg-slate-500";
  const staffTone =
    tones[(row.staffName || "").length % tones.length] ?? "bg-slate-500";

  return (
    <>
      <tr className="border-t border-slate-100 hover:bg-slate-50/60">
        <td className="px-3 py-3">
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-expanded={open}
            aria-label="Chi tiết"
          >
            <ChevronDown
              className={clsx(
                "h-4 w-4 transition",
                open ? "rotate-0" : "-rotate-90",
              )}
            />
          </button>
        </td>
        <td className="px-3 py-3 font-mono text-xs font-semibold text-slate-800">
          {row.giftCode}
        </td>
        <td className="px-3 py-3 font-medium text-slate-700">{row.orderCode}</td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <Avatar initial={row.customerInitial} tone={tone} />
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">
                {row.customerName}
              </p>
              <p className="text-xs text-slate-400">{row.customerPhone}</p>
            </div>
          </div>
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
        <td className="px-3 py-3 text-slate-600">{row.branch}</td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            {row.giftImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={row.giftImageUrl}
                alt={row.giftName}
                className="h-9 w-9 rounded-lg object-cover ring-1 ring-slate-200"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-lg">
                {row.giftEmoji}
              </span>
            )}
            <div>
              <p className="font-medium text-slate-800">{row.giftName}</p>
              <p className="text-xs text-slate-400">
                {formatMoney(row.giftPrice)}
              </p>
            </div>
          </div>
        </td>
        <td className="px-3 py-3 whitespace-nowrap text-slate-500">
          {row.redeemedAt}
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-2">
            <Avatar initial={row.staffInitial} tone={staffTone} />
            <span className="text-slate-700">{row.staffName}</span>
          </div>
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
        <td className="max-w-[140px] truncate px-3 py-3 text-slate-500">
          {row.note ?? "—"}
        </td>
        <td className="px-3 py-3">
          <button
            type="button"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Tuỳ chọn"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="border-t border-slate-50 bg-slate-50/80">
          <td colSpan={12} className="px-6 py-3 text-xs text-slate-500">
            Chi tiết: mã {row.giftCode} · đơn {row.orderCode} · xác nhận bởi{" "}
            {row.staffName}
            {row.note ? ` · Ghi chú: ${row.note}` : ""}.
          </td>
        </tr>
      ) : null}
    </>
  );
}
