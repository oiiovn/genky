"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { AttendanceStats, ShiftTodayCard } from "@/lib/attendance-api";

export function AttendanceSidePanel({
  stats,
  shifts,
}: {
  stats: AttendanceStats;
  shifts: ShiftTodayCard[];
}) {
  const checkedOut = Math.max(0, stats.checked_in - stats.working);
  const onLeave = stats.on_leave ?? 0;
  const chartData = [
    { name: "Đang làm việc", value: stats.working, color: "#F59E0B" },
    { name: "Đã check-out", value: checkedOut, color: "#10B981" },
    { name: "Nghỉ phép", value: onLeave, color: "#8B5CF6" },
    { name: "Chưa check-in", value: stats.not_checked_in, color: "#F43F5E" },
  ].filter((d) => d.value > 0);

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[300px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Tổng quan hôm nay</h3>
        <div className="mt-4 flex items-center gap-3">
          <div className="relative h-32 w-32 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  innerRadius={38}
                  outerRadius={56}
                  paddingAngle={3}
                  stroke="none"
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-lg font-bold text-slate-800">
                {stats.total}
              </span>
              <span className="text-[10px] text-slate-400">Nhân viên</span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-2 text-xs">
            {chartData.map((item) => (
              <li
                key={item.name}
                className="flex items-center justify-between gap-2"
              >
                <span className="flex items-center gap-2 text-slate-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  {item.name}
                </span>
                <span className="font-semibold text-slate-800">{item.value}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Ca làm hôm nay</h3>
        <div className="mt-4 space-y-4">
          {shifts.map((shift) => {
            const pct =
              shift.total > 0
                ? Math.round((shift.checked / shift.total) * 100)
                : 0;
            return (
              <div key={shift.id}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      {shift.name}
                    </p>
                    <p className="text-xs text-slate-400">{shift.time}</p>
                  </div>
                  <span
                    className={
                      shift.status === "ongoing"
                        ? "rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600"
                        : "rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500"
                    }
                  >
                    {shift.status === "ongoing"
                      ? "Đang diễn ra"
                      : shift.status === "upcoming"
                        ? "Sắp tới"
                        : "Đã kết thúc"}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {shift.checked}/{shift.total} đã check-in
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                  <span>
                    Đúng giờ{" "}
                    <strong className="text-emerald-600">{shift.ontime}</strong>
                  </span>
                  <span>
                    Đi trễ{" "}
                    <strong className="text-rose-500">{shift.late}</strong>
                  </span>
                  <span>
                    Chưa vào{" "}
                    <strong className="text-slate-700">{shift.missing}</strong>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          className="mt-4 w-full text-left text-sm font-medium text-indigo-600 hover:underline"
        >
          Xem lịch làm việc →
        </button>
      </section>
    </aside>
  );
}
