"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  History,
  Lightbulb,
  MapPin,
  MoreVertical,
  Plus,
  Search,
  ShoppingBag,
  Zap,
} from "lucide-react";
import { useAdminChrome } from "@/components/admin/AdminShell";
import { FlashSaleFormModal } from "@/components/marketing/flashsale/FlashSaleFormModal";
import { FlashSaleCalendar } from "@/components/marketing/flashsale/FlashSaleCalendar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  deleteFlashSale,
  emptyFlashSaleStats,
  endFlashSale,
  fetchFlashSaleHistory,
  fetchFlashSales,
  type FlashSaleBanner,
  type FlashSaleCampaign,
  type FlashSaleStatus,
  type FlashSaleStats,
} from "@/lib/marketing-api";
import { currentMonth, currentYear, APP_TIMEZONE } from "@/lib/timezone";

type FilterTab = "all" | FlashSaleStatus;

const ORANGE = "#F78C2E";

function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function splitRemain(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { days, hours, minutes, seconds };
}

function useTick(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

function monthValue(offset = 0) {
  const d = new Date(currentYear(), currentMonth() - 1 + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthOptions() {
  return [-4, -3, -2, -1, 0, 1, 2].map((offset) => {
    const value = monthValue(offset);
    const [y, m] = value.split("-");
    return { value, label: `Tháng ${m}/${y}` };
  });
}

function statusMeta(status: FlashSaleStatus) {
  if (status === "running") {
    return {
      label: "ĐANG CHẠY",
      className: "bg-emerald-50 text-emerald-600 ring-emerald-100",
    };
  }
  if (status === "upcoming") {
    return {
      label: "SẮP CHẠY",
      className: "bg-sky-50 text-sky-600 ring-sky-100",
    };
  }
  return {
    label: "ĐÃ KẾT THÚC",
    className: "bg-slate-100 text-slate-500 ring-slate-200",
  };
}

function SaleBanner({
  theme,
  title,
}: {
  theme: FlashSaleBanner;
  title: string;
}) {
  const map = {
    "88": {
      wrap: "from-[#ff7a18] via-[#ff4d4d] to-[#f9d423]",
      kicker: "FLASH SALE",
      mark: "8.8",
    },
    "99": {
      wrap: "from-[#c81d77] via-[#7b2ff7] to-[#f107a3]",
      kicker: "FLASH SALE",
      mark: "9.9",
    },
    mid: {
      wrap: "from-[#00c6ff] via-[#0072ff] to-[#00f2fe]",
      kicker: "GIỮA THÁNG",
      mark: "DEAL",
    },
    end: {
      wrap: "from-[#64748b] via-[#334155] to-[#1e293b]",
      kicker: "XẢ KHO",
      mark: "END",
    },
  } as const;
  const t = map[theme];
  return (
    <div
      className={clsx(
        "relative h-[108px] w-[148px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br text-white shadow-inner",
        t.wrap,
      )}
      title={title}
    >
      <div className="absolute -top-6 -right-6 h-20 w-20 rounded-full bg-white/15" />
      <div className="absolute -bottom-8 -left-4 h-16 w-16 rounded-full bg-black/10" />
      <div className="relative flex h-full flex-col items-center justify-center px-2 text-center">
        <p className="text-[9px] font-bold tracking-[0.18em] opacity-90">
          {t.kicker}
        </p>
        <p className="mt-0.5 text-3xl font-black italic leading-none drop-shadow">
          {t.mark}
        </p>
        <Zap className="mt-1 h-4 w-4 fill-white text-white" />
      </div>
    </div>
  );
}

function DigitBox({ value, label }: { value: string; label?: string }) {
  return (
    <div className="text-center">
      <div className="min-w-[42px] rounded-lg bg-sky-600 px-2 py-1.5 text-lg font-bold tabular-nums text-white shadow-sm">
        {value}
      </div>
      {label ? (
        <p className="mt-1 text-[10px] font-medium text-sky-500">{label}</p>
      ) : null}
    </div>
  );
}

function remainMsOf(until: string | null, now: number) {
  if (!until) return 0;
  const t = new Date(until).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, t - now);
}

function formatRemain(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}

function hmToSec(hm: string | null): number | null {
  if (!hm) return null;
  const m = hm.trim().match(/^(\d{1,2}):([0-5]\d)/);
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  return h * 3600 + Number(m[2]) * 60;
}

function hcmNowSec(now: number): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date(now)).map((p) => [p.type, p.value]),
  );
  return Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
}

type SlotPhase = {
  running: boolean;
  upcoming: boolean;
  remainMs: number;
  progress: number;
};

function slotPhase(
  slotStart: string | null,
  slotEnd: string | null,
  now: number,
  campaignEndsAt: string | null,
): SlotPhase {
  const empty: SlotPhase = {
    running: false,
    upcoming: false,
    remainMs: 0,
    progress: 0,
  };
  const startSec = hmToSec(slotStart);
  const endSec = hmToSec(slotEnd);
  if (startSec == null || endSec == null) return empty;

  const nowSec = hcmNowSec(now);
  let durationSec = 0;
  let elapsedSec = 0;
  let remainSec = 0;
  let running = false;
  let upcoming = false;

  if (endSec > startSec) {
    durationSec = endSec - startSec;
    running = nowSec >= startSec && nowSec < endSec;
    upcoming = nowSec < startSec;
    elapsedSec = nowSec - startSec;
    remainSec = running ? endSec - nowSec : startSec - nowSec;
  } else {
    durationSec = endSec + 86400 - startSec;
    running = nowSec >= startSec || nowSec < endSec;
    upcoming = nowSec < startSec && nowSec >= endSec;
    if (nowSec >= startSec) {
      elapsedSec = nowSec - startSec;
      remainSec = endSec + 86400 - nowSec;
    } else {
      elapsedSec = nowSec + 86400 - startSec;
      remainSec = running ? endSec - nowSec : startSec - nowSec;
    }
  }

  if (campaignEndsAt) {
    const untilEnd = new Date(campaignEndsAt).getTime() - now;
    if (!Number.isNaN(untilEnd) && untilEnd <= 0) {
      return empty;
    }
    if (running && !Number.isNaN(untilEnd)) {
      remainSec = Math.min(remainSec, Math.max(0, untilEnd / 1000));
    }
  }

  if (running && remainSec > 0 && durationSec > 0) {
    const progress = Math.min(100, Math.max(0, (elapsedSec / durationSec) * 100));
    return { running: true, upcoming: false, remainMs: remainSec * 1000, progress };
  }
  if (upcoming && remainSec > 0) {
    return { running: false, upcoming: true, remainMs: remainSec * 1000, progress: 0 };
  }
  return empty;
}

function campaignWindow(campaign: FlashSaleCampaign, now: number): "before" | "inside" | "after" {
  if (campaign.status === "ended") return "after";
  const start = campaign.starts_at ? new Date(campaign.starts_at).getTime() : NaN;
  const end = campaign.ends_at ? new Date(campaign.ends_at).getTime() : NaN;
  if (!Number.isNaN(start) && now < start) return "before";
  if (!Number.isNaN(end) && now > end) return "after";
  return "inside";
}

function liveCampaignView(campaign: FlashSaleCampaign, now: number) {
  const window = campaignWindow(campaign, now);
  const dateProgress = rangeProgress(campaign.starts_at, campaign.ends_at, now);

  if (window === "after") {
    return {
      status: "ended" as FlashSaleStatus,
      activeName: null as string | null,
      nextName: null as string | null,
      progress: 100,
      remainMs: 0,
      inCampaign: false,
    };
  }

  const timed = campaign.products.filter((p) => p.slot_start && p.slot_end);
  if (window === "inside" && timed.length > 0) {
    const phases = timed.map((p) => ({
      product: p,
      phase: slotPhase(p.slot_start, p.slot_end, now, campaign.ends_at),
    }));
    const running = phases.find((p) => p.phase.running);
    if (running) {
      return {
        status: "running" as FlashSaleStatus,
        activeName: running.product.name,
        nextName: null,
        progress: dateProgress,
        remainMs: running.phase.remainMs,
        inCampaign: true,
      };
    }
    const next = phases
      .filter((p) => p.phase.upcoming)
      .sort((a, b) => a.phase.remainMs - b.phase.remainMs)[0];
    if (next) {
      return {
        status: "upcoming" as FlashSaleStatus,
        activeName: null,
        nextName: next.product.name,
        progress: dateProgress,
        remainMs: next.phase.remainMs,
        inCampaign: true,
      };
    }
    const nextDay = nextDayRemainMs(timed, now, campaign.ends_at);
    if (nextDay > 0) {
      const earliest = [...timed].sort(
        (a, b) => (hmToSec(a.slot_start) ?? 0) - (hmToSec(b.slot_start) ?? 0),
      )[0];
      return {
        status: "upcoming" as FlashSaleStatus,
        activeName: null,
        nextName: earliest?.name ?? null,
        progress: dateProgress,
        remainMs: nextDay,
        inCampaign: true,
      };
    }
    return {
      status: "ended" as FlashSaleStatus,
      activeName: null,
      nextName: null,
      progress: 100,
      remainMs: 0,
      inCampaign: false,
    };
  }

  if (window === "before") {
    return {
      status: "upcoming" as FlashSaleStatus,
      activeName: null,
      nextName: timed[0]?.name ?? null,
      progress: 0,
      remainMs: remainMsOf(campaign.starts_at, now),
      inCampaign: false,
    };
  }

  return {
    status: "running" as FlashSaleStatus,
    activeName: null,
    nextName: null,
    progress: dateProgress,
    remainMs: remainMsOf(campaign.ends_at, now),
    inCampaign: true,
  };
}

function nextDayRemainMs(
  products: FlashSaleCampaign["products"],
  now: number,
  campaignEndsAt: string | null,
): number {
  const starts = products
    .map((p) => hmToSec(p.slot_start))
    .filter((n): n is number => n != null);
  if (starts.length === 0) return 0;
  const earliest = Math.min(...starts);
  const nowSec = hcmNowSec(now);
  const remainSec = 86400 - nowSec + earliest;
  let remainMs = remainSec * 1000;
  if (campaignEndsAt) {
    const untilEnd = new Date(campaignEndsAt).getTime() - now;
    if (!Number.isNaN(untilEnd) && untilEnd < remainMs) return 0;
  }
  return remainMs;
}

function rangeProgress(startAt: string | null, endAt: string | null, now: number): number {
  if (!startAt || !endAt) return 0;
  const start = new Date(startAt).getTime();
  const end = new Date(endAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
}

function CampaignMetrics({
  campaign,
  now,
}: {
  campaign: FlashSaleCampaign;
  now: number;
}) {
  const live = liveCampaignView(campaign, now);
  const parts = splitRemain(live.remainMs);

  if (live.inCampaign) {
    return (
      <div className="w-[220px] shrink-0">
        {live.status === "running" && live.activeName ? (
          <p className="text-right text-xs font-semibold text-emerald-600">
            Đang sale: {live.activeName}
          </p>
        ) : live.nextName ? (
          <p className="text-right text-xs font-semibold text-sky-600">
            Sắp chạy: {live.nextName}
          </p>
        ) : live.status === "running" ? (
          <p className="text-right text-xs font-semibold text-amber-600">
            Ngoài khung giờ món
          </p>
        ) : (
          <p className="text-right text-xs font-semibold text-sky-600">Sắp chạy</p>
        )}
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-1000 ease-linear"
            style={{ width: `${live.progress}%` }}
          />
        </div>
        <div className="mt-3 space-y-1 text-sm">
          <div className="flex justify-between text-slate-500">
            <span>Đơn đã bán</span>
            <span className="font-semibold text-slate-800">{campaign.sold}</span>
          </div>
          <div className="flex justify-between text-slate-500">
            <span>Doanh thu</span>
            <span className="font-semibold text-slate-800">
              {formatVnd(campaign.revenue)}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (live.status === "upcoming") {
    return (
      <div className="flex w-[240px] shrink-0 flex-col items-center">
        <p className="mb-2 text-[11px] font-semibold tracking-wide text-sky-500 uppercase">
          Bắt đầu sau
        </p>
        <div className="flex items-end gap-1.5">
          {parts.days > 0 ? (
            <>
              <DigitBox value={String(parts.days)} label="ngày" />
              <span className="mb-2 text-lg font-bold text-sky-400">:</span>
            </>
          ) : null}
          <DigitBox value={pad(parts.hours)} />
          <span className="mb-2 text-lg font-bold text-sky-400">:</span>
          <DigitBox value={pad(parts.minutes)} />
          <span className="mb-2 text-lg font-bold text-sky-400">:</span>
          <DigitBox value={pad(parts.seconds)} />
        </div>
      </div>
    );
  }

  return (
    <div className="w-[220px] shrink-0 text-right">
      <p className="text-xs text-slate-400">Tổng doanh thu</p>
      <p className="mt-0.5 text-lg font-bold text-slate-800">
        {formatVnd(campaign.revenue)}
      </p>
      <p className="mt-2 text-xs text-slate-400">Đơn đã bán</p>
      <p className="text-base font-semibold text-slate-700">{campaign.sold}</p>
    </div>
  );
}

function ProductThumbs({
  campaign,
  now,
}: {
  campaign: FlashSaleCampaign;
  now: number;
}) {
  if (campaign.products.length === 0) {
    return <p className="shrink-0 text-xs text-slate-400">Chưa có sản phẩm.</p>;
  }
  return (
    <div className="flex shrink-0 flex-nowrap items-stretch gap-2">
      {campaign.products.map((p) => {
        const inWindow = campaignWindow(campaign, now) === "inside";
        const live = inWindow
          ? slotPhase(p.slot_start, p.slot_end, now, campaign.ends_at)
          : { running: false, upcoming: false, remainMs: 0, progress: 0 };
        return (
          <div
            key={`${campaign.id}-${p.id ?? p.name}`}
            className={clsx(
              "w-[100px] shrink-0 rounded-xl border p-1.5 text-center",
              live.running
                ? "border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200"
                : "border-slate-100 bg-white",
            )}
          >
            <div
              className={clsx(
                "relative flex h-14 w-full items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br text-2xl",
                p.tone,
              )}
            >
              {p.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={p.image_url}
                  alt={p.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                p.emoji
              )}
            </div>
            <p className="mt-1 truncate text-[11px] font-semibold text-slate-800">
              {p.name}
            </p>
            <p className="truncate text-[10px] text-slate-500">
              {p.slot_label || "—"}
            </p>
            {live.running ? (
              <p className="mt-0.5 font-mono text-[13px] font-bold tabular-nums text-emerald-600">
                {formatRemain(live.remainMs)}
              </p>
            ) : (
              <p className="mt-0.5 text-[11px] font-bold text-orange-500">
                {formatVnd(p.price)}
              </p>
            )}
            <p className="text-[10px] text-slate-400 line-through">
              {formatVnd(p.original)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function CampaignMenu({
  campaign,
  onEdit,
  onEnd,
  onDelete,
}: {
  campaign: FlashSaleCampaign;
  onEdit: () => void;
  onEnd: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-label="Tuỳ chọn"
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
      >
        <MoreVertical className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute top-9 right-0 z-20 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          >
            Chỉnh sửa
          </button>
          {campaign.status !== "ended" ? (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onEnd();
              }}
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              Kết thúc
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="block w-full px-3 py-2 text-left text-sm text-rose-600 hover:bg-slate-50"
          >
            Xoá
          </button>
        </div>
      ) : null}
    </div>
  );
}

function CampaignCard({
  campaign,
  now,
  onEdit,
  onEnd,
  onDelete,
}: {
  campaign: FlashSaleCampaign;
  now: number;
  onEdit: () => void;
  onEnd: () => void;
  onDelete: () => void;
}) {
  const live = liveCampaignView(campaign, now);
  const meta = statusMeta(live.status);
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-4 overflow-x-auto">
        <SaleBanner theme={campaign.banner} title={campaign.title} />

        <div className="min-w-[200px] shrink-0 flex-1">
          <span
            className={clsx(
              "inline-flex rounded-md px-2 py-0.5 text-[10px] font-bold tracking-wide ring-1",
              meta.className,
            )}
          >
            {meta.label}
          </span>
          <h3 className="mt-1.5 text-base font-bold text-slate-900">
            {campaign.title}
          </h3>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <MapPin className="h-3.5 w-3.5 text-slate-400" />
            {campaign.branch}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
            {campaign.date_label}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            {campaign.slots_label}
          </p>
        </div>

        <CampaignMetrics campaign={campaign} now={now} />
        <ProductThumbs campaign={campaign} now={now} />
        <CampaignMenu
          campaign={campaign}
          onEdit={onEdit}
          onEnd={onEnd}
          onDelete={onDelete}
        />
      </div>
    </article>
  );
}

export function FlashSalePage() {
  const { branches } = useAdminChrome(
    "Quản lý chương trình Flash Sale trên Shopee",
  );
  const now = useTick(1000);

  const [tab, setTab] = useState<FilterTab>("all");
  const [branchId, setBranchId] = useState<number | "">("");
  const [month, setMonth] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [view, setView] = useState<"list" | "history" | "guide">("list");
  const [toast, setToast] = useState<string | null>(null);

  const [rows, setRows] = useState<FlashSaleCampaign[]>([]);
  const [calendarRows, setCalendarRows] = useState<FlashSaleCampaign[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [stats, setStats] = useState<FlashSaleStats>(emptyFlashSaleStats);
  const [history, setHistory] = useState<FlashSaleCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FlashSaleCampaign | null>(null);
  const [pendingEnd, setPendingEnd] = useState<FlashSaleCampaign | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FlashSaleCampaign | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setQDebounced(q), 280);
    return () => window.clearTimeout(t);
  }, [q]);

  const loadCalendar = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetchFlashSales(
        {
          status: "all",
          branch_id: branchId,
        },
        signal,
      );
      if (!signal?.aborted) setCalendarRows(res.data);
    } catch {
      if (!signal?.aborted) setCalendarRows([]);
    } finally {
      if (!signal?.aborted) setCalendarLoading(false);
    }
  }, [branchId]);

  const loadList = useCallback(async (signal?: AbortSignal) => {
    setError(null);
    try {
      const res = await fetchFlashSales(
        {
          status: tab,
          branch_id: branchId,
          month,
          search: qDebounced,
        },
        signal,
      );
      setRows(res.data);
      setStats(res.stats);
    } catch (err) {
      if (signal?.aborted) return;
      setError(err instanceof Error ? err.message : "Không tải được FlashSale.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [tab, branchId, month, qDebounced]);

  useEffect(() => {
    if (view !== "list") return;
    const ac = new AbortController();
    setLoading(true);
    void loadList(ac.signal);
    return () => ac.abort();
  }, [view, loadList]);

  useEffect(() => {
    if (view !== "list") return;
    const ac = new AbortController();
    setCalendarLoading(true);
    void loadCalendar(ac.signal);
    return () => ac.abort();
  }, [view, loadCalendar]);

  useEffect(() => {
    if (view !== "history") return;
    const ac = new AbortController();
    setLoading(true);
    setError(null);
    void fetchFlashSaleHistory(ac.signal)
      .then((data) => {
        if (!ac.signal.aborted) setHistory(data);
      })
      .catch((err: unknown) => {
        if (ac.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Không tải được lịch sử.");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [view]);

  function showToast(msg: string) {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }

  const counts = stats;
  const tabs: { id: FilterTab; label: string; count: number }[] = [
    { id: "all", label: "Tất cả", count: counts.total },
    { id: "running", label: "Đang chạy", count: counts.running },
    { id: "upcoming", label: "Sắp diễn ra", count: counts.upcoming },
    { id: "ended", label: "Đã kết thúc", count: counts.ended },
  ];

  const months = useMemo(() => monthOptions(), []);
  const deltaHint =
    counts.month_delta === 0
      ? "Bằng tháng trước"
      : counts.month_delta > 0
        ? `+${counts.month_delta} so với tháng trước`
        : `${counts.month_delta} so với tháng trước`;

  const kpi = [
    {
      label: "Tổng chương trình",
      value: counts.total,
      hint: deltaHint,
      hintClass: counts.month_delta >= 0 ? "text-emerald-600" : "text-rose-500",
      icon: ShoppingBag,
      tone: "bg-rose-50 text-rose-500",
    },
    {
      label: "Đang chạy",
      value: counts.running,
      hint: "Xem chi tiết →",
      hintClass: "text-emerald-600",
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-500",
      onClick: () => {
        setView("list");
        setTab("running");
      },
    },
    {
      label: "Sắp diễn ra",
      value: counts.upcoming,
      hint:
        counts.upcoming_in_24h > 0
          ? `${counts.upcoming_in_24h} trong 24 giờ tới`
          : "Trong 24 giờ tới",
      hintClass: "text-slate-400",
      icon: Clock,
      tone: "bg-sky-50 text-sky-500",
      onClick: () => {
        setView("list");
        setTab("upcoming");
      },
    },
    {
      label: "Đã kết thúc",
      value: counts.ended,
      hint: "Xem báo cáo →",
      hintClass: "text-violet-500",
      icon: ClipboardList,
      tone: "bg-violet-50 text-violet-500",
      onClick: () => {
        setView("list");
        setTab("ended");
      },
    },
  ];

  return (
    <main className="flex flex-1 flex-col overflow-y-auto bg-[#F7F8FA]">
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 flex-col p-5 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              FlashSale
              <Zap className="h-6 w-6 fill-orange-400 text-orange-500" />
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Quản lý chương trình Flash Sale trên Shopee
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setView("guide")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <BookOpen className="h-4 w-4" />
              Hướng dẫn
            </button>
            <button
              type="button"
              onClick={() => setView("history")}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <History className="h-4 w-4" />
              Lịch sử FlashSale
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
              style={{ backgroundColor: ORANGE }}
            >
              <Plus className="h-4 w-4" />
              Tạo chương trình
            </button>
          </div>
        </div>

        {error ? (
          <p className="mt-4 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {view !== "list" ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-900">
                {view === "history" ? "Lịch sử FlashSale" : "Hướng dẫn FlashSale"}
              </h2>
              <button
                type="button"
                onClick={() => setView("list")}
                className="text-sm font-medium text-orange-500 hover:underline"
              >
                ← Quay lại danh sách
              </button>
            </div>
            {view === "history" ? (
              loading ? (
                <div className="mt-4 h-24 animate-pulse rounded-xl bg-slate-100" />
              ) : history.length === 0 ? (
                <p className="mt-6 text-sm text-slate-500">
                  Chưa có chương trình kết thúc.
                </p>
              ) : (
                <div className="mt-4 space-y-3">
                  {history.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{c.title}</p>
                        <p className="text-xs text-slate-500">
                          {c.branch} · {c.date_label}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-slate-800">
                        {formatVnd(c.revenue)}
                      </p>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-600">
                <li>Tạo chương trình theo ngày, rồi gán khung giờ cho từng sản phẩm.</li>
                <li>Tải ảnh, giá gốc và giá Flash Sale cho mỗi món.</li>
                <li>Món đang trong khung giờ sẽ đếm ngược ngay trên thẻ sản phẩm.</li>
                <li>Kết thúc sớm hoặc xoá chương trình từ menu ba chấm.</li>
              </ol>
            )}
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {kpi.map((s) => {
                const Icon = s.icon;
                return (
                  <button
                    key={s.label}
                    type="button"
                    onClick={s.onClick}
                    className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm text-slate-500">{s.label}</p>
                        <p className="mt-1 text-3xl font-bold text-slate-900">
                          {s.value}
                        </p>
                        <p className={clsx("mt-1 text-xs font-medium", s.hintClass)}>
                          {s.hint}
                        </p>
                      </div>
                      <div
                        className={clsx(
                          "flex h-10 w-10 items-center justify-center rounded-xl",
                          s.tone,
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <FlashSaleCalendar
              campaigns={calendarRows}
              branchId={branchId}
              loading={calendarLoading}
            />

            <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap gap-2">
                  {tabs.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTab(t.id)}
                      className={clsx(
                        "rounded-lg px-3 py-1.5 text-sm font-medium",
                        tab === t.id
                          ? "bg-orange-50 text-orange-600 ring-1 ring-orange-200"
                          : "text-slate-500 hover:bg-slate-50",
                      )}
                    >
                      {t.label}{" "}
                      <span
                        className={clsx(
                          "ml-0.5",
                          tab === t.id ? "text-orange-500" : "text-slate-400",
                        )}
                      >
                        ({t.count})
                      </span>
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="relative inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                    <select
                      value={branchId === "" ? "" : String(branchId)}
                      onChange={(e) =>
                        setBranchId(e.target.value ? Number(e.target.value) : "")
                      }
                      className="appearance-none bg-transparent pr-4 font-medium text-slate-800 outline-none"
                    >
                      <option value="">Tất cả chi nhánh</option>
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400" />
                  </label>
                  <label className="relative inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
                    <CalendarDays className="h-4 w-4 text-slate-400" />
                    <select
                      value={month}
                      onChange={(e) => setMonth(e.target.value)}
                      className="appearance-none bg-transparent pr-4 font-medium text-slate-800 outline-none"
                    >
                      <option value="">Tất cả thời gian</option>
                      {months.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 h-3.5 w-3.5 text-slate-400" />
                  </label>
                  <label className="inline-flex min-w-[200px] flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm lg:max-w-[240px]">
                    <Search className="h-4 w-4 text-slate-400" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Tìm chương trình..."
                      className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-36 animate-pulse rounded-2xl bg-white"
                  />
                ))
              ) : rows.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center text-sm text-slate-500">
                  Chưa có chương trình. Bấm “Tạo chương trình” để bắt đầu.
                </div>
              ) : (
                rows.map((c) => (
                  <CampaignCard
                    key={c.id}
                    campaign={c}
                    now={now}
                    onEdit={() => {
                      setEditing(c);
                      setFormOpen(true);
                    }}
                    onEnd={() => setPendingEnd(c)}
                    onDelete={() => setPendingDelete(c)}
                  />
                ))
              )}
            </div>
          </>
        )}
      </div>

      <div className="mt-auto border-t border-orange-100 bg-[#FFF6EC] px-5 py-3 lg:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-2 text-sm">
          <p className="flex items-center gap-2 text-orange-700">
            <Lightbulb className="h-4 w-4 text-orange-500" />
            Mẹo sử dụng FlashSale hiệu quả: chọn khung giờ cao điểm, giá chênh
            rõ ràng và giới hạn số lượng để tạo cảm giác khan hiếm.
          </p>
          <button
            type="button"
            onClick={() => setView("guide")}
            className="font-medium text-orange-600 hover:underline"
          >
            Xem hướng dẫn chi tiết →
          </button>
        </div>
      </div>

      <FlashSaleFormModal
        open={formOpen}
        editing={editing}
        branches={branches}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={(message) => {
          showToast(message);
          void loadList();
          void loadCalendar();
        }}
      />

      <ConfirmDialog
        open={!!pendingEnd}
        title="Kết thúc chương trình?"
        message={
          pendingEnd
            ? `“${pendingEnd.title}” sẽ chuyển sang Đã kết thúc.`
            : ""
        }
        confirmLabel="Kết thúc"
        loading={busy}
        onClose={() => setPendingEnd(null)}
        onConfirm={() => {
          if (!pendingEnd) return;
          setBusy(true);
          void endFlashSale(pendingEnd.id)
            .then((res) => {
              showToast(res.message);
              setPendingEnd(null);
              void loadList();
              void loadCalendar();
            })
            .catch((err: unknown) => {
              showToast(err instanceof Error ? err.message : "Không kết thúc được.");
            })
            .finally(() => setBusy(false));
        }}
      />

      <ConfirmDialog
        open={!!pendingDelete}
        title="Xoá chương trình?"
        message={
          pendingDelete
            ? `Xoá “${pendingDelete.title}” và toàn bộ sản phẩm trong chương trình.`
            : ""
        }
        confirmLabel="Xoá"
        loading={busy}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (!pendingDelete) return;
          setBusy(true);
          void deleteFlashSale(pendingDelete.id)
            .then((message) => {
              showToast(message);
              setPendingDelete(null);
              void loadList();
              void loadCalendar();
            })
            .catch((err: unknown) => {
              showToast(err instanceof Error ? err.message : "Không xoá được.");
            })
            .finally(() => setBusy(false));
        }}
      />

      {toast ? (
        <div className="fixed right-5 bottom-16 z-50 rounded-xl bg-slate-900 px-4 py-2.5 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  );
}
