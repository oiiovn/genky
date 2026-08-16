"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import {
  formatMoney,
  type AdjustmentRecord,
  categoryBreakdown,
  topEmployees,
} from "@/lib/adjustments";
import { EmployeeAvatar } from "@/components/ui/EmployeeAvatar";

export function AdjustmentSidePanel({
  records,
}: {
  records: AdjustmentRecord[];
}) {
  const breakdown = categoryBreakdown(records);
  const total = records.reduce((s, r) => s + r.amount, 0);
  const topReward = topEmployees(records, "reward", 3);
  const topPenalty = topEmployees(records, "penalty", 3);

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[300px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Phân bổ thưởng / phạt</h3>
        <div className="mt-3 flex items-center gap-3">
          <div className="relative h-28 w-28 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={
                    breakdown.length
                      ? breakdown
                      : [{ name: "—", value: 1, color: "#E2E8F0" }]
                  }
                  dataKey="value"
                  innerRadius={34}
                  outerRadius={48}
                  paddingAngle={2}
                  stroke="none"
                >
                  {(breakdown.length
                    ? breakdown
                    : [{ color: "#E2E8F0" }]
                  ).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
              <span className="text-[10px] leading-tight font-bold text-slate-800">
                {formatMoney(total)}
              </span>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-1.5 text-[11px]">
            {breakdown.slice(0, 5).map((d) => (
              <li key={d.category} className="flex justify-between gap-2">
                <span className="flex min-w-0 items-center gap-1.5 text-slate-600">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="truncate">{d.name}</span>
                </span>
                <span className="shrink-0 font-semibold text-slate-800">
                  {d.percent.toFixed(0)}%
                </span>
              </li>
            ))}
            {breakdown.length === 0 ? (
              <li className="text-slate-400">Chưa có dữ liệu</li>
            ) : null}
          </ul>
        </div>
      </section>

      <TopList title="Top nhân viên được thưởng" rows={topReward} tone="reward" />
      <TopList title="Top nhân viên bị phạt" rows={topPenalty} tone="penalty" />
    </aside>
  );
}

function TopList({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: {
    employee_id: number;
    full_name: string;
    avatar: string | null;
    department: string;
    amount: number;
  }[];
  tone: "reward" | "penalty";
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="font-semibold text-slate-800">{title}</h3>
      <ul className="mt-3 space-y-3">
        {rows.length === 0 ? (
          <li className="text-sm text-slate-400">Chưa có dữ liệu</li>
        ) : (
          rows.map((r, i) => (
            <li key={r.employee_id} className="flex items-center gap-3">
              <span className="w-4 text-xs font-bold text-slate-400">
                {i + 1}
              </span>
              <EmployeeAvatar
                avatar={r.avatar}
                name={r.full_name}
                code={String(r.employee_id)}
                className="h-9 w-9 rounded-full"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  {r.full_name}
                </p>
                <p className="truncate text-xs text-slate-400">{r.department}</p>
              </div>
              <span
                className={
                  tone === "reward"
                    ? "text-sm font-semibold text-emerald-600"
                    : "text-sm font-semibold text-rose-600"
                }
              >
                {formatMoney(r.amount)}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
