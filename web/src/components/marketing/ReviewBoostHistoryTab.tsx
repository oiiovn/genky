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
  Filter,
  Gift,
  MoreVertical,
  Pencil,
  Search,
  Trash2,
  X,
  TicketCheck,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import type { Branch } from "@/lib/api";
import { formatReviewCount } from "@/lib/review-boost-demo";
import {
  checkMarketingRewardCode,
  deleteMarketingRedemption,
  fetchMarketingRedemptionHistory,
  redeemMarketingRewardCode,
  updateMarketingRedemption,
  type MarketingRewardCodeCheck,
} from "@/lib/marketing-api";
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

function formatIso(iso: string | null): string {
  if (!iso) return "Không hạn";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const codeStatusUi: Record<string, { label: string; className: string }> = {
  ISSUED: {
    label: "Chưa đổi",
    className: "bg-amber-50 text-amber-700 ring-amber-100",
  },
  REDEEMED: {
    label: "Đã tặng",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  },
  CANCELLED: {
    label: "Đã huỷ",
    className: "bg-slate-100 text-slate-600 ring-slate-200",
  },
  EXPIRED: {
    label: "Hết hạn",
    className: "bg-rose-50 text-rose-700 ring-rose-100",
  },
};

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
  from,
  to,
  refreshTick = 0,
  onToast,
}: {
  branches: Branch[];
  branchId?: number | "";
  from?: string;
  to?: string;
  refreshTick?: number;
  onToast?: (message: string) => void;
}) {
  const [stats, setStats] = useState<ReviewRedeemStats>(emptyStats);
  const [redeemRows, setRedeemRows] = useState<ReviewRedeemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [branch, setBranch] = useState("");
  const [channel, setChannel] = useState<"" | ReviewChannel>("");
  const [status, setStatus] = useState<"" | ReviewRedeemStatus>("");
  const [staff, setStaff] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [localTick, setLocalTick] = useState(0);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [editRow, setEditRow] = useState<ReviewRedeemRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ReviewRedeemRow | null>(
    null,
  );
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setLoadError(null);
    void fetchMarketingRedemptionHistory(
      { branch_id: branchId, from, to },
      ac.signal,
    )
      .then((data) => {
        if (ac.signal.aborted) return;
        setStats(data.redeemStats ?? emptyStats);
        setRedeemRows(data.redeemRows ?? []);
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
  }, [branchId, from, to, refreshTick, localTick]);

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

  async function handleDelete(row: ReviewRedeemRow) {
    setDeleteBusy(true);
    try {
      await deleteMarketingRedemption(row.id);
      setPendingDelete(null);
      onToast?.("Đã xoá lượt đổi quà.");
      setLocalTick((n) => n + 1);
    } catch (e: unknown) {
      onToast?.(e instanceof Error ? e.message : "Không xoá được lượt đổi quà.");
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleSaveEdit(payload: {
    branch_id?: number;
    note: string;
  }) {
    if (!editRow) return;
    await updateMarketingRedemption(editRow.id, {
      branch_id: payload.branch_id,
      note: payload.note,
    });
    onToast?.("Đã lưu lịch sử đổi quà.");
    setEditRow(null);
    setLocalTick((n) => n + 1);
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

  return (
    <div className="space-y-5">
      <StaffRedeemPanel
        branches={branches}
        preferredBranchId={typeof branchId === "number" ? branchId : null}
        onRedeemed={() => setLocalTick((n) => n + 1)}
      />

      {loadError ? (
        <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-800">
          {loadError}
        </p>
      ) : loading && redeemRows.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
          Đang tải lịch sử đổi quà…
        </p>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
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
                    menuOpen={menuId === row.id}
                    onToggle={() => toggleExpand(row.id)}
                    onMenu={() =>
                      setMenuId((id) => (id === row.id ? null : row.id))
                    }
                    onEdit={() => {
                      setMenuId(null);
                      setEditRow(row);
                    }}
                    onDelete={() => {
                      setMenuId(null);
                      setPendingDelete(row);
                    }}
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
      {editRow ? (
        <EditRedemptionModal
          row={editRow}
          branches={branches}
          onClose={() => setEditRow(null)}
          onSave={(payload) => handleSaveEdit(payload)}
        />
      ) : null}
      {pendingDelete ? (
        <ConfirmDialog
          open
          title="Xoá lượt đổi quà"
          message={`Xoá lượt đổi mã ${pendingDelete.giftCode}? Mã tặng sẽ được mở lại để đổi.`}
          loading={deleteBusy}
          onClose={() => {
            if (!deleteBusy) setPendingDelete(null);
          }}
          onConfirm={() => void handleDelete(pendingDelete)}
        />
      ) : null}
    </div>
  );
}

function StaffRedeemPanel({
  branches,
  preferredBranchId,
  onRedeemed,
}: {
  branches: Branch[];
  preferredBranchId: number | null;
  onRedeemed: () => void;
}) {
  const [query, setQuery] = useState("");
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [found, setFound] = useState<MarketingRewardCodeCheck | null>(null);
  const [redeemBranchId, setRedeemBranchId] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);

  async function handleCheck() {
    const code = query.trim();
    if (!code) {
      setCheckError("Nhập mã tặng hoặc mã đơn.");
      return;
    }
    setChecking(true);
    setCheckError(null);
    setRedeemMsg(null);
    setFound(null);
    try {
      const data = await checkMarketingRewardCode(code);
      setFound(data);
      const fromCheck = data.branch?.id;
      const next =
        preferredBranchId ??
        (fromCheck && branches.some((b) => b.id === fromCheck)
          ? fromCheck
          : (branches[0]?.id ?? ""));
      setRedeemBranchId(next);
    } catch (e: unknown) {
      setCheckError(
        e instanceof Error ? e.message : "Không kiểm tra được mã tặng.",
      );
    } finally {
      setChecking(false);
    }
  }

  async function handleRedeem() {
    if (!found?.valid) return;
    if (!redeemBranchId) {
      setCheckError("Chọn chi nhánh xác nhận tặng.");
      return;
    }
    setRedeeming(true);
    setCheckError(null);
    setRedeemMsg(null);
    try {
      await redeemMarketingRewardCode(found.id, {
        branch_id: Number(redeemBranchId),
        note: note.trim() || undefined,
      });
      setRedeemMsg("Đã xác nhận tặng món.");
      setFound({
        ...found,
        valid: false,
        status: "REDEEMED",
        reason: "Mã đã được đổi.",
        redeemed_at: new Date().toISOString(),
      });
      setNote("");
      onRedeemed();
    } catch (e: unknown) {
      setCheckError(
        e instanceof Error ? e.message : "Không xác nhận được tặng món.",
      );
    } finally {
      setRedeeming(false);
    }
  }

  const st = found
    ? (codeStatusUi[found.status] ?? {
        label: found.status,
        className: "bg-slate-100 text-slate-600 ring-slate-200",
      })
    : null;

  return (
    <section className="rounded-2xl border border-blue-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
          <TicketCheck className="h-5 w-5" />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Kiểm tra & xác nhận tặng
          </h3>
          <p className="text-xs text-slate-500">
            Nhập mã tặng hoặc mã đơn để nhân viên đối chiếu rồi xác nhận đã tặng
            món.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleCheck();
          }}
          placeholder="Mã tặng hoặc mã đơn, ví dụ GENKY-XXXX, #08086-443874188 hoặc GF-888"
          className="min-w-[240px] flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-sm outline-none focus:border-blue-400 focus:bg-white"
        />
        <button
          type="button"
          onClick={() => void handleCheck()}
          disabled={checking}
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {checking ? "Đang kiểm tra…" : "Kiểm tra"}
        </button>
      </div>

      {checkError ? (
        <p className="mt-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {checkError}
        </p>
      ) : null}
      {redeemMsg ? (
        <p className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {redeemMsg}
        </p>
      ) : null}

      {found ? (
        <div className="mt-4 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[auto_1fr]">
          {found.missing_review ? (
            <p className="col-span-full flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Phát hiện chưa có đánh giá,{" "}
                <span className="underline underline-offset-2">kiểm tra ngay</span>
              </span>
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            {found.reward?.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={found.reward.image_url}
                alt={found.reward.name}
                className="h-20 w-20 rounded-xl object-cover ring-1 ring-slate-200"
              />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-xl bg-white text-3xl ring-1 ring-slate-200">
                🎁
              </span>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-slate-900">
                {found.reward?.name ?? "Quà tặng"}
              </p>
              <p className="text-xs text-slate-500">
                {found.reward
                  ? `Chi phí ${formatMoney(found.reward.value)}${
                      found.reward.display_value
                        ? ` · Trị giá ${formatMoney(found.reward.display_value)}`
                        : ""
                    }`
                  : "—"}
              </p>
              {st ? (
                <span
                  className={clsx(
                    "mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
                    st.className,
                  )}
                >
                  {st.label}
                </span>
              ) : null}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[11px] tracking-wide text-slate-400 uppercase">
                Mã tặng
              </dt>
              <dd className="font-mono font-semibold text-slate-800">
                {found.code}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wide text-slate-400 uppercase">
                Mã đơn
              </dt>
              <dd className="font-medium text-slate-700">
                {found.order?.order_code || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wide text-slate-400 uppercase">
                Hết hạn
              </dt>
              <dd className="text-slate-700">{formatIso(found.expires_at)}</dd>
            </div>
            <div>
              <dt className="text-[11px] tracking-wide text-slate-400 uppercase">
                Khách
              </dt>
              <dd className="text-slate-700">
                {found.customer?.name || "—"}
                {found.customer?.phone ? ` · ${found.customer.phone}` : ""}
              </dd>
            </div>
            {found.reason ? (
              <div className="col-span-2 sm:col-span-2">
                <dt className="text-[11px] tracking-wide text-slate-400 uppercase">
                  Ghi chú
                </dt>
                <dd className="text-slate-700">{found.reason}</dd>
              </div>
            ) : null}
          </dl>

          {found.valid ? (
            <div className="col-span-full flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3">
              <label className="min-w-[180px] text-sm">
                <span className="mb-1 block text-xs text-slate-500">
                  Chi nhánh tặng
                </span>
                <select
                  value={redeemBranchId === "" ? "" : String(redeemBranchId)}
                  onChange={(e) =>
                    setRedeemBranchId(
                      e.target.value ? Number(e.target.value) : "",
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none"
                >
                  <option value="">Chọn chi nhánh</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-[200px] flex-1 text-sm">
                <span className="mb-1 block text-xs text-slate-500">
                  Ghi chú (tuỳ chọn)
                </span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Ví dụ: đã giao tại quầy"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
                />
              </label>
              <button
                type="button"
                onClick={() => void handleRedeem()}
                disabled={redeeming || !redeemBranchId}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {redeeming ? "Đang xác nhận…" : "Xác nhận tặng"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function RedeemRow({
  row,
  open,
  menuOpen,
  onToggle,
  onMenu,
  onEdit,
  onDelete,
}: {
  row: ReviewRedeemRow;
  open: boolean;
  menuOpen: boolean;
  onToggle: () => void;
  onMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
        <td className="relative px-3 py-3">
          <button
            type="button"
            onClick={onMenu}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Tuỳ chọn"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {menuOpen ? (
            <div className="absolute top-10 right-3 z-20 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
              <button
                type="button"
                onClick={onEdit}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Sửa
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Xoá
              </button>
            </div>
          ) : null}
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

function EditRedemptionModal({
  row,
  branches,
  onClose,
  onSave,
}: {
  row: ReviewRedeemRow;
  branches: Branch[];
  onClose: () => void;
  onSave: (payload: { branch_id?: number; note: string }) => Promise<void>;
}) {
  const matched = branches.find(
    (b) => b.id === row.branchId || b.name === row.branch,
  );
  const [branchId, setBranchId] = useState<number | "">(matched?.id ?? "");
  const [note, setNote] = useState(row.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">
              Sửa lịch sử đổi quà
            </h3>
            <p className="mt-0.5 font-mono text-sm text-slate-500">
              {row.giftCode}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Chi nhánh
            <select
              value={branchId === "" ? "" : String(branchId)}
              onChange={(e) =>
                setBranchId(e.target.value ? Number(e.target.value) : "")
              }
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
            >
              <option value="">Chọn chi nhánh</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Ghi chú
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none"
              placeholder="Ghi chú khi tặng món"
            />
          </label>
          {error ? (
            <p className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-800">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setSaving(true);
              setError(null);
              void onSave({
                branch_id: branchId === "" ? undefined : Number(branchId),
                note,
              })
                .catch((e: unknown) => {
                  setError(e instanceof Error ? e.message : "Không lưu được.");
                })
                .finally(() => setSaving(false));
            }}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}
