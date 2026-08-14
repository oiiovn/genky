"use client";

import {
  AlertTriangle,
  Clock3,
  Copy,
  FileSpreadsheet,
  Moon,
  Printer,
  Sun,
  Sunset,
  Users,
} from "lucide-react";
import type { Shift } from "@/lib/shifts-api";
import { formatHoursMinutes } from "@/lib/schedule-utils";

export type WeekOverview = {
  totalAssignments: number;
  totalMinutes: number;
  byShift: { shift: Shift; count: number }[];
  offDays: number;
  unscheduledEmployees: number;
  understaffedShifts: number;
};

export function ScheduleSidePanel({
  overview,
  onQuickAction,
}: {
  overview: WeekOverview;
  onQuickAction: (action: string) => void;
}) {
  const iconFor = (name: string, color: string) => {
    const lower = name.toLowerCase();
    const cls = "h-4 w-4";
    if (lower.includes("sáng") || lower.includes("gay sang") || lower.includes("gãy sáng"))
      return <Sun className={cls} style={{ color }} />;
    if (lower.includes("chiều") || lower.includes("gãy chiều"))
      return <Sunset className={cls} style={{ color }} />;
    if (lower.includes("tối") || lower.includes("đêm"))
      return <Moon className={cls} style={{ color }} />;
    return <Clock3 className={cls} style={{ color }} />;
  };

  const alerts = [
    overview.unscheduledEmployees > 0
      ? {
          id: "unscheduled",
          title: `${overview.unscheduledEmployees} nhân viên chưa có lịch`,
          tone: "amber" as const,
        }
      : null,
    overview.understaffedShifts > 0
      ? {
          id: "understaffed",
          title: `${overview.understaffedShifts} ca chưa đủ nhân sự`,
          tone: "rose" as const,
        }
      : null,
  ].filter(Boolean) as { id: string; title: string; tone: "amber" | "rose" }[];

  const actions = [
    { id: "template", label: "Tạo lịch theo mẫu", icon: Users },
    { id: "copy", label: "Sao chép lịch", icon: Copy },
    { id: "export", label: "Xuất Excel", icon: FileSpreadsheet },
    { id: "print", label: "In lịch làm việc", icon: Printer },
  ];

  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[300px]">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Tổng quan tuần</h3>
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Tổng số ca</span>
            <span className="font-semibold text-slate-800">
              {overview.totalAssignments} ca làm
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-500">Tổng giờ</span>
            <span className="font-semibold text-slate-800">
              {formatHoursMinutes(overview.totalMinutes)}
            </span>
          </div>
          <div className="my-2 h-px bg-slate-100" />
          <ul className="space-y-2.5">
            {overview.byShift.map(({ shift, count }) => (
              <li
                key={shift.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2 text-slate-600">
                  {iconFor(shift.name, shift.color)}
                  {shift.name}
                </span>
                <span className="font-semibold text-slate-800">{count}</span>
              </li>
            ))}
            <li className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-slate-600">
                <span className="inline-flex h-4 w-4 items-center justify-center rounded bg-slate-100 text-[9px] font-bold text-slate-500">
                  OFF
                </span>
                Ngày nghỉ
              </span>
              <span className="font-semibold text-slate-800">
                {overview.offDays}
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Thông báo</h3>
        <div className="mt-3 space-y-3">
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-400">Không có cảnh báo tuần này.</p>
          ) : (
            alerts.map((a) => (
              <div
                key={a.id}
                className={
                  a.tone === "amber"
                    ? "rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5"
                    : "rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5"
                }
              >
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    className={
                      a.tone === "amber"
                        ? "mt-0.5 h-4 w-4 text-amber-500"
                        : "mt-0.5 h-4 w-4 text-rose-500"
                    }
                  />
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {a.title}
                    </p>
                    <button
                      type="button"
                      className="mt-1 text-xs font-semibold text-indigo-600"
                    >
                      Xem chi tiết
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800">Lịch làm việc nhanh</h3>
        <div className="mt-3 space-y-1">
          {actions.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onQuickAction(id)}
              className="flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-500">
                <Icon className="h-4 w-4" />
              </span>
              {label}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
