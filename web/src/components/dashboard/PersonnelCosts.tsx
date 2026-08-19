"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChevronDown } from "lucide-react";
import type { DashboardData } from "@/types/dashboard";

export function PersonnelCosts({
  data,
}: {
  data: DashboardData["personnel_costs"];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-800">
            Chi phí nhân sự
          </h2>
          <p className="mt-1 text-xl font-bold text-slate-800">
            {(data.total / 1_000_000).toFixed(2)}tr{" "}
            <span
              className={
                data.growth < 0
                  ? "text-sm font-semibold text-rose-500"
                  : "text-sm font-semibold text-emerald-500"
              }
            >
              {data.growth < 0 ? "↓" : "↑"} {Math.abs(data.growth)}%
            </span>
          </p>
        </div>
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-600"
        >
          {data.month}
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.days} barSize={10}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94A3B8", fontSize: 11 }}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: "#EEF2FF" }}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                fontSize: 12,
              }}
              formatter={(value) => [`${value}tr`, "Chi phí"]}
            />
            <Bar dataKey="value" fill="#6366F1" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
