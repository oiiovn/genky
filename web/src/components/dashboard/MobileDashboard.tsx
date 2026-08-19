"use client";

import Link from "next/link";
import clsx from "clsx";
import {
  AlarmClock,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Megaphone,
  Users,
} from "lucide-react";
import { EmployeeAvatar } from "@/components/ui/EmployeeAvatar";
import { LeaveInbox } from "@/components/dashboard/LeaveInbox";
import { PersonnelCosts } from "@/components/dashboard/PersonnelCosts";
import type { DashboardData, Kpi } from "@/types/dashboard";

const kpiIcon = {
  total: Users,
  working: Briefcase,
  not_checked_in: Clock3,
  late: AlarmClock,
};

const kpiTone = {
  blue: "bg-indigo-50 text-indigo-600",
  green: "bg-emerald-50 text-emerald-600",
  orange: "bg-amber-50 text-amber-600",
  red: "bg-rose-50 text-rose-600",
  sky: "bg-sky-50 text-sky-600",
};

const statusStyle = {
  on_time: "bg-emerald-50 text-emerald-600",
  late: "bg-rose-50 text-rose-600",
  pending: "bg-amber-50 text-amber-600",
  on_leave: "bg-violet-50 text-violet-600",
};

function formatVnd(value: number) {
  const abs = Math.abs(value);
  return `${value < 0 ? "-" : ""}${abs.toLocaleString("vi-VN")} đ`;
}

function trendText(kpi: Kpi) {
  if (!kpi.trend) return null;
  if (kpi.trend.dir === "flat" || kpi.trend.value === 0) {
    return { text: `— ${kpi.trend.label}`, className: "text-slate-400" };
  }
  if (kpi.trend.dir === "up") {
    return {
      text: `↑ ${kpi.trend.value}% ${kpi.trend.label}`,
      className: "text-emerald-600",
    };
  }
  return {
    text: `↓ ${kpi.trend.value}% ${kpi.trend.label}`,
    className: "text-rose-500",
  };
}

export function MobileDashboard({
  data,
  onChanged,
}: {
  data: DashboardData;
  onChanged: () => void;
}) {
  const kpis = data.kpis.filter((k) => k.key !== "absent");
  const nextShift = data.upcoming_shifts[0] ?? null;
  const maxAbs = Math.max(
    ...data.salary_projection.breakdown.map((b) => Math.abs(b.value)),
    1,
  );

  return (
    <main className="space-y-4 px-4 py-4">
      <LeaveInbox items={data.pending_leaves ?? []} onChanged={onChanged} />

      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {kpis.map((kpi) => {
          const Icon = kpiIcon[kpi.key as keyof typeof kpiIcon] ?? Users;
          const tone = kpiTone[kpi.color];
          const trend = trendText(kpi);
          return (
            <article
              key={kpi.key}
              className="min-w-[148px] flex-1 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"
            >
              <div
                className={clsx(
                  "mb-2 flex h-8 w-8 items-center justify-center rounded-xl",
                  tone,
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-[11px] text-slate-500">{kpi.label}</p>
              <p className="mt-0.5 text-xl font-bold text-slate-900">
                {kpi.value}
              </p>
              {trend ? (
                <p className={clsx("mt-1 text-[10px] font-medium", trend.className)}>
                  {trend.text}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Tình hình chấm công hôm nay
          </h2>
          <Link
            href="/attendance"
            className="inline-flex items-center text-xs font-medium text-indigo-600"
          >
            Xem tất cả
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-[1.4fr_0.8fr_0.7fr_1fr] gap-1 border-b border-slate-100 px-4 pb-2 text-[10px] font-medium tracking-wide text-slate-400 uppercase">
          <span>Nhân viên</span>
          <span>Ca làm</span>
          <span>Check-in</span>
          <span>Trạng thái</span>
        </div>
        {data.attendance_today.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-400">
            Chưa có nhân viên chấm công hôm nay.
          </p>
        ) : (
          <ul>
            {data.attendance_today.slice(0, 6).map((row) => (
              <li
                key={row.id}
                className="grid grid-cols-[1.4fr_0.8fr_0.7fr_1fr] items-center gap-1 border-b border-slate-50 px-4 py-2.5 last:border-0"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <EmployeeAvatar
                    avatar={row.avatar}
                    name={row.name}
                    className="h-8 w-8 rounded-full"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">
                      {row.name}
                    </p>
                    <p className="truncate text-[10px] text-slate-400">
                      {row.role}
                    </p>
                  </div>
                </div>
                <span className="truncate text-[11px] text-slate-600">
                  {row.shift}
                </span>
                <span className="text-[11px] font-medium text-slate-700">
                  {row.check_in ?? "—"}
                </span>
                <span
                  className={clsx(
                    "inline-flex justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                    statusStyle[row.status],
                  )}
                >
                  {row.status === "on_time" ? "Đã check-in" : row.status_label}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            Hiệu suất nhân sự
          </h2>
          <PerformanceDonut data={data.performance} />
          <ul className="mt-3 space-y-1.5">
            {data.performance.metrics.map((metric) => (
              <li
                key={metric.label}
                className="flex items-center justify-between text-[10px]"
              >
                <span className="flex items-center gap-1.5 text-slate-500">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: metric.color }}
                  />
                  {metric.label}
                </span>
                <span className="font-semibold text-slate-700">
                  {metric.value}%
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">
            Dự kiến lương tháng {data.salary_projection.month}
          </h2>
          <p className="mt-1 text-lg font-bold tracking-tight text-slate-900">
            {data.salary_projection.total_formatted}
          </p>
          <p
            className={clsx(
              "text-[10px] font-medium",
              data.salary_projection.growth >= 0
                ? "text-emerald-600"
                : "text-rose-500",
            )}
          >
            {data.salary_projection.growth >= 0 ? "+" : ""}
            {data.salary_projection.growth}% so với tháng trước
          </p>
          <ul className="mt-3 space-y-2">
            {data.salary_projection.breakdown.map((item) => (
              <li key={item.label}>
                <div className="mb-0.5 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500">{item.label}</span>
                  <span className="font-medium text-slate-700">
                    {formatVnd(item.value)}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round((Math.abs(item.value) / maxAbs) * 100)}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <PersonnelCosts data={data.personnel_costs} />

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Ca làm sắp tới</h2>
          <Link
            href="/schedule"
            className="inline-flex items-center text-xs font-medium text-indigo-600"
          >
            Xem lịch
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {nextShift ? (
          <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800">
                {nextShift.name}
              </p>
              <p className="text-xs text-slate-500">{nextShift.time}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-medium text-slate-500">
                {nextShift.when ?? "Hôm nay"}
              </p>
              <p className="text-[11px] font-semibold text-indigo-600">
                {nextShift.remaining ?? ""}
              </p>
            </div>
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
            Chưa có ca làm sắp tới
          </p>
        )}
      </section>

      <section
        id="notifications"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Thông báo</h2>
          <span className="inline-flex items-center text-xs font-medium text-indigo-600">
            Xem tất cả
            <ChevronRight className="h-3.5 w-3.5" />
          </span>
        </div>
        {data.notifications.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
            Chưa có thông báo
          </p>
        ) : (
          <ul className="space-y-3">
            {data.notifications.slice(0, 4).map((item) => (
              <li key={String(item.id)} className="flex items-start gap-3">
                <div
                  className={clsx(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    item.type === "employee"
                      ? "bg-sky-50 text-sky-600"
                      : item.type === "leave"
                        ? "bg-rose-50 text-rose-500"
                        : item.type === "warning"
                          ? "bg-orange-50 text-orange-500"
                          : "bg-indigo-50 text-indigo-600",
                  )}
                >
                  {item.type === "employee" || item.type === "shift" ? (
                    <Megaphone className="h-4 w-4" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">
                    {item.title}
                  </p>
                  {item.message ? (
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                      {item.message}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-slate-400">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function PerformanceDonut({
  data,
}: {
  data: DashboardData["performance"];
}) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (data.overall / 100) * c;

  return (
    <div className="relative mx-auto h-[108px] w-[108px]">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#EEF2FF"
          strokeWidth="10"
        />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke="#6366F1"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-slate-800">{data.overall}%</span>
        <span className="text-[9px] text-slate-400">Hiệu suất chung</span>
      </div>
    </div>
  );
}
