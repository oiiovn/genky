"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { LogIn, LogOut } from "lucide-react";
import { useStaff } from "@/components/staff/StaffShell";
import {
  checkInAttendance,
  checkOutAttendance,
  fetchMyAttendances,
  fetchStaffCheckStatus,
  getStaffGeolocation,
  statusLabel,
  statusTone,
  type AttendanceRow,
  type StaffCheckStatus,
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

function rowForDate(rows: AttendanceRow[], date: string): AttendanceRow | null {
  return rows.find((r) => r.work_date === date) ?? null;
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function StaffAttendancePage() {
  const { session } = useStaff();
  const dates = useMemo(() => recentDates(14), []);
  const [selected, setSelected] = useState(dates[0]);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [check, setCheck] = useState<StaffCheckStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [waitLeft, setWaitLeft] = useState(0);

  const primaryBranchId =
    session.branches.find((b) => b.is_primary)?.id ?? session.branches[0]?.id;
  const isToday = selected === todayIso();

  const reload = useCallback(async () => {
    const [data, status] = await Promise.all([
      fetchMyAttendances({
        from: dates[dates.length - 1],
        to: dates[0],
      }),
      fetchStaffCheckStatus(primaryBranchId).catch(() => null),
    ]);
    setRows(data);
    setCheck(status);
    setWaitLeft(status?.today.seconds_until_checkout ?? 0);
  }, [dates, primaryBranchId]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        await reload();
      } catch {
        setRows([]);
        setCheck(null);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [reload]);

  const countingDown = waitLeft > 0;
  useEffect(() => {
    if (!countingDown) return;
    const id = window.setInterval(() => {
      setWaitLeft((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          void reload().catch(() => undefined);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [countingDown, reload]);

  async function runAction(kind: "in" | "out") {
    if (!check || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const geo = await getStaffGeolocation();
      if (kind === "in") {
        await checkInAttendance({
          employee_id: check.employee_id,
          branch_id: check.branch.id,
          latitude: geo.latitude,
          longitude: geo.longitude,
          source: "staff_app",
          location_label: `App · ${check.branch.name}`,
        });
      } else {
        await checkOutAttendance({
          employee_id: check.employee_id,
          branch_id: check.branch.id,
          latitude: geo.latitude,
          longitude: geo.longitude,
          source: "staff_app",
        });
      }
      await reload();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không thể chấm công.");
    } finally {
      setBusy(false);
    }
  }

  const row = rowForDate(rows, selected);
  const history = dates.slice(0, 7).map((date) => ({
    date,
    row: rowForDate(rows, date),
  }));

  const today = check?.today;
  const showCheckIn = isToday && Boolean(today?.can_check_in);
  const showCheckOut =
    isToday &&
    (Boolean(today?.can_check_out) ||
      (Boolean(check?.allow_check_out) &&
        Boolean(check?.qr_enabled) &&
        today?.ui_status === "working" &&
        waitLeft > 0));

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
        ) : row || (isToday && check) ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">{row?.shift_name || "Ca làm"}</p>
                <p className="text-lg font-semibold text-white">
                  {row?.branch_name ?? check?.branch.name ?? "Chi nhánh"}
                </p>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  statusTone[(row?.ui_status ?? today?.ui_status ?? "not_checked_in") as keyof typeof statusTone]
                }`}
              >
                {statusLabel[(row?.ui_status ?? today?.ui_status ?? "not_checked_in") as keyof typeof statusLabel]}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <p className="text-xs text-slate-400">Check-in</p>
                <p className="mt-1 text-xl font-semibold text-emerald-300">
                  {row?.check_in ?? today?.check_in ?? "—"}
                </p>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <p className="text-xs text-slate-400">Check-out</p>
                <p className="mt-1 text-xl font-semibold text-sky-300">
                  {row?.check_out ?? today?.check_out ?? "—"}
                </p>
              </div>
            </div>
            {row ? (
              <p className="text-sm text-slate-400">
                Tổng giờ:{" "}
                <span className="font-medium text-white">
                  {row.total_hours ?? "—"}
                </span>
                {row.location ? ` · ${row.location}` : ""}
              </p>
            ) : null}

            {actionError ? (
              <p className="rounded-2xl bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
                {actionError}
              </p>
            ) : null}

            {showCheckIn || showCheckOut ? (
              <div className="grid gap-2">
                {showCheckIn ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAction("in")}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-60"
                  >
                    <LogIn className="h-4 w-4" />
                    {busy ? "Đang xử lý..." : "Check-in"}
                  </button>
                ) : null}
                {showCheckOut ? (
                  <button
                    type="button"
                    disabled={busy || waitLeft > 0 || !today?.can_check_out}
                    onClick={() => void runAction("out")}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-60"
                  >
                    <LogOut className="h-4 w-4" />
                    {waitLeft > 0
                      ? `Check-out sau ${formatCountdown(waitLeft)}`
                      : busy
                        ? "Đang xử lý..."
                        : "Check-out"}
                  </button>
                ) : null}
              </div>
            ) : null}
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
