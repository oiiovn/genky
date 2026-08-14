import { todayIso as appTodayIso } from "@/lib/timezone";

export type WeekDay = {
  iso: string;
  label: string;
  dayNum: string;
  monthDay: string;
  isToday: boolean;
};

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDisplayDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function formatRangeLabel(from: string, to: string): string {
  const [fy, fm, fd] = from.split("-");
  const [ty, tm, td] = to.split("-");
  return `${fd}/${fm}/${fy} - ${td}/${tm}/${ty}`;
}

export function buildWeekDays(anchor: Date, todayIso?: string): WeekDay[] {
  const start = startOfWeek(anchor);
  const today = todayIso ?? appTodayIso();
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(start, i);
    const iso = toIsoDate(d);
    const weekday = d.getDay();
    return {
      iso,
      label: WEEKDAY_LABELS[weekday],
      dayNum: String(d.getDate()).padStart(2, "0"),
      monthDay: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
      isToday: iso === today,
    };
  });
}

export function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.slice(0, 5).split(":").map(Number);
  const [eh, em] = end.slice(0, 5).split(":").map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) mins += 24 * 60;
  return mins;
}

export function formatHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export function formatHoursShort(totalMinutes: number): string {
  const h = Math.round(totalMinutes / 60);
  return `${h}h`;
}

/** Soft chip style from shift hex color */
export function shiftChipStyle(color: string | null | undefined): {
  background: string;
  color: string;
  borderColor: string;
} {
  const hex = (color || "#3BB2F6").replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex.padEnd(6, "0").slice(0, 6);
  const r = parseInt(full.slice(0, 2), 16) || 59;
  const g = parseInt(full.slice(2, 4), 16) || 178;
  const b = parseInt(full.slice(4, 6), 16) || 246;
  return {
    background: `rgba(${r}, ${g}, ${b}, 0.12)`,
    color: `rgb(${Math.max(0, r - 40)}, ${Math.max(0, g - 40)}, ${Math.max(0, b - 20)})`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.35)`,
  };
}

export const TARGET_WEEK_MINUTES = 40 * 60;
