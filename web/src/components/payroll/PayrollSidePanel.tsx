"use client";

import { Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer } from "recharts";
import {
  averageNet,
  formatMoney,
  type DepartmentCost,
  type PayrollRow,
  type PayrollStats,
} from "@/lib/payroll";

export function PayrollSidePanel({
  stats,
  rows,
  departments,
}: {
  stats: PayrollStats;
  rows: PayrollRow[];
  departments: DepartmentCost[];
}) {
  const avg = averageNet(rows);
  const paid = rows.filter((r) => r.status === "paid").length;
  const pending = rows.filter((r) => r.status === "pending").length;
  const paidPct = rows.length > 0 ? (paid / rows.length) * 100 : 0;
  const pendingPct = rows.length > 0 ? (pending / rows.length) * 100 : 0;

  const spark = [0.72, 0.78, 0.75, 0.82, 0.88, 0.91, 1].map((v, i) => ({
    i,
    v: avg * v,
  }));

  const reminders = [
    { day: "05", month: "Th09", title: "Ngày tạo bảng lương", sub: "Tháng tới" },
    { day: "10", month: "Th09", title: "Hạn duyệt bảng lương", sub: "Còn 26 ngày" },
    { day: "15", month: "Th09", title: "Ngày thanh toán lương", sub: "Còn 31 ngày" },
  ];

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[300px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Phân bổ chi phí lương</h3>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-28 w-28 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={departments.length ? departments : [{ name: "—", value: 1, color: "#E2E8F0" }]}
                  dataKey="value"
                  innerRadius={32}
                  outerRadius={48}
                  paddingAngle={2}
                  stroke="none"
                >
                  {(departments.length ? departments : [{ color: "#E2E8F0" }]).map(
                    (entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ),
                  )}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
            {departments.slice(0, 5).map((d) => (
              <li key={d.name} className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="truncate">{d.name}</span>
                </span>
                <span className="shrink-0 font-semibold text-slate-800">
                  {formatMoney(d.value)}
                </span>
              </li>
            ))}
            {departments.length === 0 ? (
              <li className="text-slate-400">Chưa có dữ liệu</li>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Lương trung bình</h3>
        <p className="mt-2 text-2xl font-bold text-slate-800">
          {formatMoney(avg)}
        </p>
        <div className="mt-3 h-16">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={spark}>
              <Line
                type="monotone"
                dataKey="v"
                stroke="#8B5CF6"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Trạng thái thanh toán</h3>
        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
          <div className="flex h-full w-full">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${paidPct}%` }}
            />
            <div
              className="h-full bg-amber-400"
              style={{ width: `${pendingPct}%` }}
            />
          </div>
        </div>
        <div className="mt-3 flex justify-between text-xs">
          <span className="text-emerald-600">
            Đã trả {paid} ({paidPct.toFixed(0)}%)
          </span>
          <span className="text-amber-600">
            Chờ {pending} ({pendingPct.toFixed(0)}%)
          </span>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Đã chi {formatMoney(stats.paid_amount ?? 0)} · Còn nợ{" "}
          {formatMoney(
            stats.remaining ??
              Math.max(0, (stats.net ?? stats.fund) - (stats.paid_amount ?? 0)),
          )}
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Lịch nhắc</h3>
        <ul className="mt-3 space-y-3">
          {reminders.map((r) => (
            <li key={r.title} className="flex items-center gap-3">
              <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <span className="text-sm font-bold leading-none">{r.day}</span>
                <span className="text-[10px] font-medium">{r.month}</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {r.title}
                </p>
                <p className="text-xs text-slate-400">{r.sub}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
