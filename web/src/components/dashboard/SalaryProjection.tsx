"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { DashboardData } from "@/types/dashboard";

function formatVnd(value: number) {
  const abs = Math.abs(value);
  return `${value < 0 ? "-" : ""}${abs.toLocaleString("vi-VN")} đ`;
}

export function SalaryProjection({
  data,
}: {
  data: DashboardData["salary_projection"];
}) {
  const chartData = data.breakdown.map((item) => ({
    name: item.label,
    value: Math.abs(item.value),
    color: item.color,
  }));

  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-600 p-5 text-white shadow-lg shadow-indigo-200">
      <div className="pointer-events-none absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-16 left-10 h-44 w-44 rounded-full bg-white/5" />

      <div className="relative">
        <p className="text-sm text-indigo-100">
          Dự kiến lương tháng {data.month}
        </p>
        <div className="mt-1 flex items-end gap-3">
          <h2 className="text-2xl font-bold tracking-tight">
            {data.total_formatted}
          </h2>
          <span className="mb-1 rounded-full bg-emerald-400/20 px-2 py-0.5 text-xs font-semibold text-emerald-200">
            ↑ {data.growth}% so với tháng trước
          </span>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="relative h-36 w-36 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  innerRadius={42}
                  outerRadius={62}
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
              <span className="text-lg font-bold">{data.employees ?? 0}</span>
              <span className="text-[10px] text-indigo-100">Nhân viên</span>
            </div>
          </div>

          <ul className="min-w-0 flex-1 space-y-2">
            {data.breakdown.map((item) => (
              <li
                key={item.label}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-indigo-100">{item.label}</span>
                </div>
                <span className="font-semibold">{formatVnd(item.value)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
