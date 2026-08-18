"use client";

import { useMemo, useState } from "react";
import {
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { ChevronDown } from "lucide-react";
import type {
  ReviewChannelSlice,
  ReviewDailyChannel,
  ReviewDailyPoint,
} from "@/lib/review-boost-types";
import { formatReviewCount } from "@/lib/review-boost-demo";

export function ReviewDailyChart({
  data,
  channels = [],
}: {
  data: ReviewDailyPoint[];
  channels?: ReviewDailyChannel[];
}) {
  const [channel, setChannel] = useState("all");

  const series = useMemo(() => {
    if (channel === "all") return data;
    return data.map((point) => ({
      ...point,
      count: Number(point.byChannel?.[channel] ?? 0),
    }));
  }, [channel, data]);

  const xInterval = series.length > 14 ? Math.ceil(series.length / 8) - 1 : 0;

  return (
    <section className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-800">
            Đánh giá 5★ theo ngày
          </h3>
          <p className="text-xs text-slate-400">Xu hướng trong kỳ đã chọn</p>
        </div>
        <label className="relative">
          <span className="sr-only">Kênh</span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="appearance-none rounded-lg border border-slate-200 bg-white py-1.5 pr-7 pl-2.5 text-xs text-slate-600 outline-none"
          >
            <option value="all">Tất cả kênh</option>
            {channels.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute top-1/2 right-2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        </label>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval={xInterval}
              tick={{ fill: "#94A3B8", fontSize: 11 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94A3B8", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #E2E8F0",
                fontSize: 12,
              }}
              formatter={(value) => [
                formatReviewCount(Number(value ?? 0)),
                "Đánh giá",
              ]}
              labelFormatter={(_, payload) => {
                const row = payload?.[0]?.payload as ReviewDailyPoint | undefined;
                return row?.date
                  ? new Date(row.date).toLocaleDateString("vi-VN")
                  : "";
              }}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke="#3B82F6"
              strokeWidth={2.5}
              dot={
                series.length <= 45
                  ? { r: 3, fill: "#3B82F6", strokeWidth: 0 }
                  : false
              }
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

export function ReviewChannelDonut({
  channels,
}: {
  channels: ReviewChannelSlice[];
}) {
  const total = useMemo(
    () => channels.reduce((sum, c) => sum + c.value, 0),
    [channels],
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-800">Kênh đánh giá</h3>
      <div className="mt-2 flex items-center gap-3">
        <div className="h-36 w-36 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={channels}
                dataKey="value"
                nameKey="label"
                innerRadius={42}
                outerRadius={64}
                paddingAngle={2}
                strokeWidth={0}
              >
                {channels.map((c) => (
                  <Cell key={c.id} fill={c.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="min-w-0 flex-1 space-y-2 text-sm">
          {channels.map((c) => {
            const pct = total > 0 ? Math.round((c.value / total) * 100) : 0;
            return (
              <li key={c.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-slate-600">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: c.color }}
                  />
                  {c.label}
                </span>
                <span className="font-semibold text-slate-800">
                  {pct}% · {formatReviewCount(c.value)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function ReviewRedeemGauge({
  ratePct,
  numer,
  denom,
  deltaPct,
}: {
  ratePct: number;
  numer: number;
  denom: number;
  deltaPct: number;
}) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(100, Math.max(0, ratePct)) / 100);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-800">Tỷ lệ đổi quà</h3>
      <div className="mt-3 flex flex-col items-center">
        <div className="relative h-36 w-36">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke="#E2E8F0"
              strokeWidth="12"
            />
            <circle
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke="#38BDF8"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={offset}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-2xl font-bold text-slate-900">
              {ratePct.toFixed(1)}%
            </p>
          </div>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          {formatReviewCount(numer)} / {formatReviewCount(denom)}
        </p>
        <p className="mt-1 text-sm font-semibold text-emerald-500">
          ↑ {deltaPct.toFixed(1)}%
        </p>
      </div>
    </section>
  );
}
