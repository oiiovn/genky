/** Chuẩn múi giờ toàn hệ thống Genky: giờ Hồ Chí Minh (UTC+7). */
export const APP_TIMEZONE = "Asia/Ho_Chi_Minh" as const;

function partsInAppTz(date: Date = new Date()): {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
} {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(date).map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Ngày hiện tại theo giờ HCM, dạng YYYY-MM-DD. */
export function todayIso(date: Date = new Date()): string {
  const p = partsInAppTz(date);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Giờ:phút hiện tại theo giờ HCM. */
export function nowHm(date: Date = new Date()): string {
  const p = partsInAppTz(date);
  return `${p.hour}:${p.minute}`;
}

/** Tháng hiện tại theo giờ HCM (1–12). */
export function currentMonth(date: Date = new Date()): number {
  return Number(partsInAppTz(date).month);
}

/** Năm hiện tại theo giờ HCM. */
export function currentYear(date: Date = new Date()): number {
  return Number(partsInAppTz(date).year);
}

/** Date “ảo” mang đúng Y-M-D theo giờ HCM (dùng cho calendar UI). */
export function nowInAppTz(date: Date = new Date()): Date {
  const p = partsInAppTz(date);
  return new Date(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour),
    Number(p.minute),
    Number(p.second),
  );
}
