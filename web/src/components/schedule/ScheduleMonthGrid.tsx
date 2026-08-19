"use client";

import clsx from "clsx";
import type { ScheduleAssignment } from "@/lib/schedule-api";
import { shiftChipStyle, type MonthDay } from "@/lib/schedule-utils";
import { leaveChipStyle } from "@/lib/schedule-leave";

const MAX_CHIPS = 3;

export type MonthDaySummary = {
  employeeCount: number;
  assignmentCount: number;
  shifts: { id: number; name: string; color: string; count: number }[];
};

function summarizeDay(assignments: ScheduleAssignment[]): MonthDaySummary {
  const employees = new Set<number>();
  const shiftMap = new Map<
    number,
    { id: number; name: string; color: string; count: number }
  >();

  for (const a of assignments) {
    if (a.employee?.id) employees.add(a.employee.id);
    if (!a.shift) continue;
    const existing = shiftMap.get(a.shift.id);
    if (existing) {
      existing.count += 1;
    } else {
      shiftMap.set(a.shift.id, {
        id: a.shift.id,
        name: a.shift.name,
        color: a.shift.color,
        count: 1,
      });
    }
  }

  return {
    employeeCount: employees.size,
    assignmentCount: assignments.length,
    shifts: Array.from(shiftMap.values()).sort((a, b) => b.count - a.count),
  };
}

export function ScheduleMonthGrid({
  days,
  byDate,
  leavesByDate = {},
  selectedDate,
  loading,
  refreshing,
  onDayClick,
}: {
  days: MonthDay[];
  byDate: Record<string, ScheduleAssignment[]>;
  leavesByDate?: Record<string, { label: string; count: number; type?: string }[]>;
  selectedDate?: string | null;
  loading?: boolean;
  refreshing?: boolean;
  onDayClick: (iso: string) => void;
}) {
  const headerLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const showLoadingOverlay =
    Boolean(loading) &&
    !Object.values(byDate).some((rows) => rows.length > 0);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-busy={refreshing || loading || undefined}
    >
      {refreshing ? (
        <span className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 bg-indigo-400" />
      ) : null}

      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/80">
        {headerLabels.map((label) => (
          <div
            key={label}
            className="px-2 py-2.5 text-center text-[11px] font-semibold tracking-wide text-slate-500 uppercase"
          >
            {label}
          </div>
        ))}
      </div>

      <div
        className={clsx(
          "grid grid-cols-7 transition-opacity duration-150",
          refreshing && "opacity-60",
        )}
      >
        {days.map((day) => {
          if (!day.isCurrentMonth) {
            return (
              <div
                key={day.iso}
                className="min-h-[108px] border-r border-b border-slate-100 bg-slate-50/40 p-2"
                aria-hidden
              >
                <span className="text-xs font-medium text-slate-300">
                  {day.dayNum}
                </span>
              </div>
            );
          }

          const summary = summarizeDay(byDate[day.iso] ?? []);
          const leaveItems = leavesByDate[day.iso] ?? [];
          const chips = summary.shifts.slice(0, MAX_CHIPS);
          const extra = summary.shifts.length - chips.length;
          const selected = selectedDate === day.iso;

          return (
            <button
              key={day.iso}
              type="button"
              onClick={() => onDayClick(day.iso)}
              className={clsx(
                "min-h-[108px] border-r border-b border-slate-100 p-2 text-left transition hover:bg-indigo-50/40",
                day.isToday && "bg-indigo-50/30",
                selected && "ring-2 ring-indigo-400 ring-inset",
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span
                  className={clsx(
                    "inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    day.isToday
                      ? "bg-indigo-500 text-white"
                      : "text-slate-700",
                  )}
                >
                  {day.dayNum}
                </span>
                {summary.assignmentCount > 0 ? (
                  <span className="text-[10px] font-medium text-slate-400">
                    {summary.assignmentCount} ca
                  </span>
                ) : null}
              </div>

              <p className="mt-1 text-[11px] font-medium text-slate-600">
                {summary.employeeCount} nhân viên
              </p>

              <div className="mt-1.5 space-y-1">
                {leaveItems.map((item) => {
                  const style = leaveChipStyle(item.type || "annual");
                  return (
                    <div
                      key={item.label}
                      className="truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-tight"
                      style={style}
                    >
                      {item.label} · {item.count}
                    </div>
                  );
                })}
                {chips.map((shift) => {
                  const style = shiftChipStyle(shift.color);
                  return (
                    <div
                      key={shift.id}
                      className="truncate rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-tight"
                      style={style}
                      title={`${shift.name}: ${shift.count}`}
                    >
                      {shift.name} · {shift.count}
                    </div>
                  );
                })}
                {extra > 0 ? (
                  <p className="text-[10px] font-semibold text-slate-400">
                    +{extra}
                  </p>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>

      {showLoadingOverlay ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/50 text-sm text-slate-400">
          Đang tải...
        </div>
      ) : null}
    </div>
  );
}
