import type { FlashSaleCampaign } from "@/lib/marketing-api";
import { APP_TIMEZONE } from "@/lib/timezone";

/** Hàng giờ trên lưới lịch (theo mock Shopee). */
export const FLASH_CALENDAR_ROWS = ["13:00", "16:00", "20:00", "22:00"] as const;

export const FLASH_CALENDAR_WEEKDAYS = [
  { id: 1, label: "T2" },
  { id: 2, label: "T3" },
  { id: 3, label: "T4" },
  { id: 4, label: "T5" },
  { id: 5, label: "T6" },
  { id: 6, label: "T7" },
  { id: 0, label: "CN" },
] as const;

export type FlashCalendarMarker = {
  label: string;
  dotClass: string;
  textClass: string;
  productName: string;
  campaignTitle: string;
  slotStart: string;
  slotEnd: string;
  price: number;
};

export type FlashCalendarDayEntry = {
  slotLabel: string;
  name: string;
  price: number;
  campaignTitle: string;
  sortKey: number;
};

function hmToMinutes(hm: string | null): number | null {
  if (!hm) return null;
  const m = hm.trim().match(/^(\d{1,2}):([0-5]\d)/);
  if (!m) return null;
  const h = Number(m[1]);
  if (h > 23) return null;
  return h * 60 + Number(m[2]);
}

function isoDateInAppTz(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function addDaysIso(iso: string, delta: number): string {
  const [y, mo, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return formatUtcYmd(dt);
}

/** Thứ Hai của tuần chứa `ref` (theo giờ HCM). */
export function mondayOfWeek(ref: Date = new Date()): string {
  const iso = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(ref);
  const wd = weekdayIndex(iso);
  const offset = wd === 0 ? -6 : 1 - wd;
  return addDaysIso(iso, offset);
}

function formatUtcYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 7 ngày T2→CN bắt đầu từ `weekStart` (ISO). */
export function weekDatesFromMonday(weekStart: string): string[] {
  const [y, mo, d] = weekStart.split("-").map(Number);
  const base = Date.UTC(y, mo - 1, d, 12, 0, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(base + i * 86400000);
    return formatUtcYmd(dt);
  });
}

export function weekdayIndex(iso: string): number {
  const [y, mo, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d, 12, 0, 0)).getUTCDay();
}

export function formatDayVi(iso: string): string {
  const [, mo, d] = iso.split("-");
  return `${d}/${mo}`;
}

export function slotToGridRow(slotStart: string | null): string | null {
  const startMin = hmToMinutes(slotStart);
  if (startMin == null) return null;
  let best: (typeof FLASH_CALENDAR_ROWS)[number] | null = null;
  let bestDiff = Infinity;
  for (const row of FLASH_CALENDAR_ROWS) {
    const rowMin = hmToMinutes(row);
    if (rowMin == null) continue;
    const diff = Math.abs(startMin - rowMin);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = row;
    }
  }
  if (best == null || bestDiff > 120) return null;
  return best;
}

export function productShortLabel(name: string): string {
  const n = name.trim();
  const lower = n.toLowerCase();
  if (/combo/.test(lower)) return "Combo";
  if (/^set\b|\bset\b/.test(lower)) return "SET";
  if (/cuốn|cuon/.test(lower)) return "Cuốn";
  if (n.length <= 4) return n;
  return "FS";
}

export function labelStyle(label: string): { dot: string; text: string } {
  switch (label) {
    case "SET":
      return { dot: "bg-rose-500", text: "text-rose-600" };
    case "Combo":
      return { dot: "bg-sky-500", text: "text-sky-600" };
    case "Cuốn":
      return { dot: "bg-orange-400", text: "text-orange-600" };
    case "FS":
      return { dot: "bg-orange-500", text: "text-orange-600" };
    default:
      return { dot: "bg-violet-500", text: "text-violet-600" };
  }
}

function campaignActiveOnDate(campaign: FlashSaleCampaign, dateIso: string): boolean {
  const start = isoDateInAppTz(campaign.starts_at);
  const end = isoDateInAppTz(campaign.ends_at);
  if (!start || !end) return false;
  return dateIso >= start && dateIso <= end;
}

function branchMatches(campaign: FlashSaleCampaign, branchId: number | ""): boolean {
  if (branchId === "") return true;
  return campaign.branch_id === branchId;
}

export function filterCalendarCampaigns(
  campaigns: FlashSaleCampaign[],
): FlashSaleCampaign[] {
  return campaigns.filter(
    (c) => c.status === "running" || c.status === "upcoming",
  );
}

export type FlashCalendarGrid = Record<
  string,
  Record<string, FlashCalendarMarker[]>
>;

/** Lưới: row (13:00…) → cột ngày ISO → markers. */
export function buildCalendarGrid(
  campaigns: FlashSaleCampaign[],
  weekStart: string,
  branchId: number | "",
): { grid: FlashCalendarGrid; dates: string[] } {
  const dates = weekDatesFromMonday(weekStart);
  const grid: FlashCalendarGrid = {};
  for (const row of FLASH_CALENDAR_ROWS) {
    grid[row] = {};
    for (const date of dates) grid[row][date] = [];
  }

  for (const campaign of campaigns) {
    if (!branchMatches(campaign, branchId)) continue;
    for (const date of dates) {
      if (!campaignActiveOnDate(campaign, date)) continue;
      for (const p of campaign.products) {
        const row = slotToGridRow(p.slot_start);
        if (!row) continue;
        const label = productShortLabel(p.name);
        const style = labelStyle(label);
        grid[row][date].push({
          label,
          dotClass: style.dot,
          textClass: style.text,
          productName: p.name,
          campaignTitle: campaign.title,
          slotStart: p.slot_start ?? "",
          slotEnd: p.slot_end ?? "",
          price: p.price,
        });
      }
    }
  }

  return { grid, dates };
}

export function buildDayDetail(
  campaigns: FlashSaleCampaign[],
  dateIso: string,
  branchId: number | "",
): FlashCalendarDayEntry[] {
  const entries: FlashCalendarDayEntry[] = [];

  for (const campaign of campaigns) {
    if (!branchMatches(campaign, branchId)) continue;
    if (!campaignActiveOnDate(campaign, dateIso)) continue;
    for (const p of campaign.products) {
      if (!p.slot_start || !p.slot_end) continue;
      const sortKey = hmToMinutes(p.slot_start) ?? 0;
      entries.push({
        slotLabel: `${p.slot_start}–${p.slot_end}`,
        name: p.name,
        price: p.price,
        campaignTitle: campaign.title,
        sortKey,
      });
    }
  }

  entries.sort((a, b) => a.sortKey - b.sortKey || a.name.localeCompare(b.name, "vi"));
  return entries;
}

export function formatDayDetailText(
  dateIso: string,
  entries: FlashCalendarDayEntry[],
  formatVnd: (n: number) => string,
): string {
  const head = formatDayVi(dateIso);
  if (entries.length === 0) return `${head}\n(Không có khung giờ)`;
  const lines = entries.map(
    (e) => `${e.slotLabel} → ${e.name} → ${formatVnd(e.price)}`,
  );
  return `${head}\n${lines.join("\n")}`;
}

export function shiftWeekStart(weekStart: string, deltaWeeks: number): string {
  const [y, mo, d] = weekStart.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + deltaWeeks * 7);
  return formatUtcYmd(dt);
}

export function weekRangeLabel(weekStart: string): string {
  const dates = weekDatesFromMonday(weekStart);
  return `${formatDayVi(dates[0])} – ${formatDayVi(dates[6])}`;
}
