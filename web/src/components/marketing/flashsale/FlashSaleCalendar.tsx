"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
} from "lucide-react";
import type { FlashSaleCampaign } from "@/lib/marketing-api";
import {
  buildCalendarGrid,
  buildDayDetail,
  filterCalendarCampaigns,
  FLASH_CALENDAR_ROWS,
  FLASH_CALENDAR_WEEKDAYS,
  formatDayDetailText,
  formatDayVi,
  mondayOfWeek,
  shiftWeekStart,
  weekDatesFromMonday,
  weekRangeLabel,
} from "@/lib/flash-sale-calendar";

function formatVnd(n: number) {
  return `${n.toLocaleString("vi-VN")}đ`;
}

export function FlashSaleCalendar({
  campaigns,
  branchId,
  loading,
}: {
  campaigns: FlashSaleCampaign[];
  branchId: number | "";
  loading?: boolean;
}) {
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek());
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  });
  const [copied, setCopied] = useState(false);

  const active = useMemo(
    () => filterCalendarCampaigns(campaigns),
    [campaigns],
  );

  const { grid, dates } = useMemo(
    () => buildCalendarGrid(active, weekStart, branchId),
    [active, weekStart, branchId],
  );

  const detailDate = selectedDate ?? dates[0] ?? weekStart;
  const dayEntries = useMemo(
    () => buildDayDetail(active, detailDate, branchId),
    [active, detailDate, branchId],
  );

  const weekdayHeaders = useMemo(() => {
    const map = weekDatesFromMonday(weekStart);
    return FLASH_CALENDAR_WEEKDAYS.map((w, i) => ({
      label: w.label,
      date: map[i],
    }));
  }, [weekStart]);

  async function copyDay() {
    const text = formatDayDetailText(detailDate, dayEntries, formatVnd);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900">
            <CalendarDays className="h-5 w-5 text-orange-500" />
            Lịch Flash Sale
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Xem nhanh khung giờ đang chạy / sắp chạy trong tuần
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setWeekStart((w) => shiftWeekStart(w, -1))}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Tuần trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[7rem] text-center text-sm font-semibold text-slate-700">
            {weekRangeLabel(weekStart)}
          </span>
          <button
            type="button"
            onClick={() => setWeekStart((w) => shiftWeekStart(w, 1))}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
            aria-label="Tuần sau"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => void copyDay()}
            className="ml-1 rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            aria-label="Sao chép lịch ngày"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-600" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-4 h-40 animate-pulse rounded-xl bg-slate-100" />
      ) : (
        <>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[520px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-14 pb-2 text-left text-[11px] font-semibold text-slate-400" />
                  {weekdayHeaders.map(({ label, date }) => {
                    const selected = detailDate === date;
                    return (
                      <th key={date} className="pb-2">
                        <button
                          type="button"
                          onClick={() => setSelectedDate(date)}
                          className={clsx(
                            "w-full rounded-lg px-1 py-1.5 text-[11px] font-bold transition",
                            selected
                              ? "bg-orange-50 text-orange-600 ring-1 ring-orange-200"
                              : "text-slate-600 hover:bg-slate-50",
                          )}
                        >
                          <span className="block">{label}</span>
                          <span className="mt-0.5 block text-[10px] font-medium text-slate-400">
                            {formatDayVi(date)}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {FLASH_CALENDAR_ROWS.map((row) => (
                  <tr key={row} className="border-t border-slate-100">
                    <td className="py-2 pr-2 text-[11px] font-semibold text-slate-500">
                      {row}
                    </td>
                    {dates.map((date) => {
                      const items = grid[row]?.[date] ?? [];
                      const selected = detailDate === date;
                      return (
                        <td
                          key={date}
                          className={clsx(
                            "min-w-[4.5rem] px-1 py-2 align-top",
                            selected && "bg-orange-50/40",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedDate(date)}
                            className="flex min-h-[2rem] w-full flex-wrap justify-center gap-1"
                          >
                            {items.length === 0 ? (
                              <span className="text-slate-200">·</span>
                            ) : (
                              items.map((m, i) => (
                                <span
                                  key={`${m.label}-${i}`}
                                  className="inline-flex max-w-full items-center gap-0.5 rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold shadow-sm ring-1 ring-slate-100"
                                  title={`${m.productName} (${m.campaignTitle})`}
                                >
                                  <span
                                    className={clsx(
                                      "h-1.5 w-1.5 shrink-0 rounded-full",
                                      m.dotClass,
                                    )}
                                  />
                                  <span className={clsx("truncate", m.textClass)}>
                                    {m.label}
                                  </span>
                                </span>
                              ))
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 p-3.5">
            <p className="text-sm font-bold text-slate-800">
              {formatDayVi(detailDate)}
            </p>
            {dayEntries.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">
                Không có sản phẩm Flash Sale trong ngày này.
              </p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {dayEntries.map((e, i) => (
                  <li
                    key={`${e.slotLabel}-${e.name}-${i}`}
                    className="text-[13px] text-slate-700"
                  >
                    <span className="font-medium text-slate-500">
                      {e.slotLabel}
                    </span>
                    <span className="text-slate-400"> → </span>
                    <span className="font-medium text-slate-800">{e.name}</span>
                    <span className="text-slate-400"> → </span>
                    <span className="font-semibold text-orange-600">
                      {formatVnd(e.price)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </section>
  );
}
