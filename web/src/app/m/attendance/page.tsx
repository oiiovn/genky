"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useStaff } from "@/components/staff/StaffShell";
import {
  fetchAttendances,
  statusLabel,
  statusTone,
  type AttendanceRow,
} from "@/lib/attendance-api";
import { dayLabel, weekdayShort } from "@/lib/staff";
import { todayIso } from "@/lib/timezone";

function recentDates(count: number): string[] {
  const base = todayIso();
  const [y, m, d] = base.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const dt = new Date(y, m - 1, d - i);
    const yy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    out.push(`${yy}-${mm}-${dd}`);
  }
  return out;
}

export default function StaffAttendancePage() {
  const { session } = useStaff();
  const dates = useMemo(() => recentDates(14), []);
  const [selected, setSelected] = useState(dates[0]);
  const [row, setRow] = useState<AttendanceRow | null>(null);
  const [history, setHistory] = useState<
    { date: string; row: AttendanceRow | null }[]
  >([]);
  const [loading, setLoading] = useState(true);

  const loadDay = useCallback(
    async (date: string) => {
      setLoading(true);
      try {
        const res = await fetchAttendances({ date, per_page: 50 });
        const mine =
          res.data.find((r) => r.employee_id === session.employeeId) ??
          res.data[0] ??
          null;
        setRow(mine);
      } catch {
        setRow(null);
      } finally {
        setLoading(false);
      }
    },
    [session.employeeId],
  );

  useEffect(() => {
    void loadDay(selected);
  }, [selected, loadDay]);

  useEffect(() => {
    async function loadHistory() {
      const slice = dates.slice(0, 7);
      const results = await Promise.all(
        slice.map(async (date) => {
          try {
            const res = await fetchAttendances({ date, per_page: 50 });
            const mine =
              res.data.find((r) => r.employee_id === session.employeeId) ??
              res.data[0] ??
              null;
            return { date, row: mine };
          } catch {
            return { date, row: null };
          }
        }),
      );
      setHistory(results);
    }
    void loadHistory();
  }, [dates, session.employeeId]);

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold text-white">Chấm công của tôi</h1>
      <p className="mt-1 text-sm text-slate-400">14 ngày gần đây</p>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
        {dates.map((date) => {
          const active = date === selected;
          return (
            <button
              key={date}
              type="button"
              onClick={() => setSelected(date)}
              className={clsx(
                "min-w-[3.4rem] rounded-2xl border px-2 py-2 text-center",
                active
                  ? "border-sky-400/50 bg-sky-500/20 text-white"
                  : "border-white/10 bg-white/5 text-slate-400",
              )}
            >
              <div className="text-[10px] uppercase">{weekdayShort(date)}</div>
              <div className="text-sm font-semibold">{dayLabel(date)}</div>
            </button>
          );
        })}
      </div>

      <section className="mt-4 rounded-3xl border border-white/10 bg-white/5 p-4">
        {loading ? (
          <p className="text-sm text-slate-400">Đang tải...</p>
        ) : row ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{row.shift_name || "Ca làm"}</p>
                <p className="text-lg font-semibold text-white">
                  {row.branch_name ?? "Chi nhánh"}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[row.ui_status]}`}
              >
                {statusLabel[row.ui_status]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <p className="text-xs text-slate-400">Check-in</p>
                <p className="mt-1 text-xl font-semibold text-emerald-300">
                  {row.check_in ?? "—"}
                </p>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <p className="text-xs text-slate-400">Check-out</p>
                <p className="mt-1 text-xl font-semibold text-sky-300">
                  {row.check_out ?? "—"}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-400">
              Tổng giờ:{" "}
              <span className="font-medium text-white">
                {row.total_hours ?? "—"}
              </span>
              {row.location ? ` · ${row.location}` : ""}
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Không có bản ghi ngày này.</p>
        )}
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-300">7 ngày gần nhất</h2>
        <div className="space-y-2">
          {history.map((item) => (
            <button
              key={item.date}
              type="button"
              onClick={() => setSelected(item.date)}
              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-3 py-3 text-left"
            >
              <div>
                <p className="text-sm font-medium text-white">
                  {dayLabel(item.date)} · {weekdayShort(item.date)}
                </p>
                <p className="text-xs text-slate-400">
                  {item.row
                    ? `${item.row.check_in ?? "—"} → ${item.row.check_out ?? "—"}`
                    : "Không có dữ liệu"}
                </p>
              </div>
              {item.row ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusTone[item.row.ui_status]}`}
                >
                  {statusLabel[item.row.ui_status]}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
