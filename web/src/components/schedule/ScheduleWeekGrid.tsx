"use client";

import clsx from "clsx";
import type { ScheduleAssignment } from "@/lib/schedule-api";
import type { Employee } from "@/lib/employees-api";
import type { Shift } from "@/lib/shifts-api";
import { EmployeeAvatar } from "@/components/ui/EmployeeAvatar";
import {
  TARGET_WEEK_MINUTES,
  formatHoursShort,
  minutesBetween,
  shiftChipStyle,
  type WeekDay,
} from "@/lib/schedule-utils";

export type ScheduleRow = {
  employee: Employee;
  byDate: Record<string, ScheduleAssignment[]>;
  minutes: number;
};

function ShiftChip({
  assignment,
  onRemove,
}: {
  assignment: ScheduleAssignment;
  onRemove?: () => void;
}) {
  const shift = assignment.shift;
  if (!shift) return null;
  const style = shiftChipStyle(shift.color);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onRemove?.();
      }}
      title="Bấm để gỡ ca"
      className="w-full rounded-lg border px-2 py-1.5 text-left transition hover:brightness-95"
      style={style}
    >
      <p className="truncate text-[11px] font-semibold leading-tight">
        {shift.name}
      </p>
      <p className="mt-0.5 text-[10px] opacity-80">
        {shift.start_time} - {shift.end_time}
      </p>
    </button>
  );
}

function GridSkeleton({ days }: { days: WeekDay[] }) {
  return (
    <>
      {Array.from({ length: 6 }, (_, index) => (
        <tr key={`skeleton-${index}`} className="border-b border-slate-100">
          <td className="sticky left-0 z-10 bg-white px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-slate-100" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-28 rounded bg-slate-100" />
                <div className="h-2.5 w-16 rounded bg-slate-50" />
              </div>
            </div>
          </td>
          {days.map((day) => (
            <td key={day.iso} className="px-1.5 py-2">
              <div className="min-h-[72px] rounded-xl bg-slate-50" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function ScheduleWeekGrid({
  days,
  rows,
  legendShifts,
  loading,
  refreshing,
  onCellClick,
  onRemoveAssignment,
}: {
  days: WeekDay[];
  rows: ScheduleRow[];
  legendShifts: Shift[];
  loading?: boolean;
  refreshing?: boolean;
  onCellClick: (employee: Employee, dayIso: string) => void;
  onRemoveAssignment: (assignment: ScheduleAssignment) => void;
}) {
  const showSkeleton = rows.length === 0 && Boolean(loading);
  const showEmpty = rows.length === 0 && !loading;
  const dimRows = Boolean(refreshing) && rows.length > 0;

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      aria-busy={refreshing || loading || undefined}
    >
      {refreshing ? (
        <span className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 bg-indigo-400" />
      ) : null}
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="sticky left-0 z-10 w-[220px] bg-slate-50 px-4 py-3 text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                Nhân viên
              </th>
              {days.map((day) => (
                <th
                  key={day.iso}
                  className="px-2 py-3 text-center text-[11px] font-semibold text-slate-500"
                >
                  <div className="flex flex-col items-center gap-1">
                    <span>{day.label}</span>
                    <span
                      className={clsx(
                        "inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-xs font-bold",
                        day.isToday
                          ? "bg-indigo-500 text-white"
                          : "text-slate-700",
                      )}
                    >
                      {day.dayNum}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            className={clsx(
              "transition-opacity duration-150",
              dimRows && "opacity-60",
            )}
          >
            {showSkeleton ? (
              <GridSkeleton days={days} />
            ) : showEmpty ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-16 text-center text-sm text-slate-400"
                >
                  Chưa có nhân viên để hiển thị lịch.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const target = TARGET_WEEK_MINUTES;
                const hoursLabel = `${formatHoursShort(row.minutes)} / ${formatHoursShort(target)}`;
                return (
                  <tr
                    key={row.employee.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="sticky left-0 z-10 bg-white px-4 py-3">
                      <div className="flex items-center gap-3">
                        <EmployeeAvatar
                          avatar={row.employee.avatar}
                          name={row.employee.full_name}
                          code={row.employee.employee_code}
                          className="h-10 w-10 rounded-full"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">
                            {row.employee.full_name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {row.employee.position?.name ?? "—"}
                          </p>
                          <p className="text-[11px] font-medium text-indigo-500">
                            {hoursLabel}
                          </p>
                        </div>
                      </div>
                    </td>
                    {days.map((day) => {
                      const cells = row.byDate[day.iso] ?? [];
                      return (
                        <td key={day.iso} className="px-1.5 py-2 align-top">
                          <button
                            type="button"
                            onClick={() =>
                              onCellClick(row.employee, day.iso)
                            }
                            className={clsx(
                              "flex min-h-[72px] w-full flex-col gap-1 rounded-xl border border-dashed p-1.5 text-left transition",
                              cells.length
                                ? "border-transparent hover:bg-slate-50"
                                : "border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/40",
                            )}
                          >
                            {cells.length === 0 ? (
                              <span className="m-auto text-xs font-semibold text-slate-400">
                                OFF
                              </span>
                            ) : (
                              cells.map((a) => (
                                <ShiftChip
                                  key={a.id}
                                  assignment={a}
                                  onRemove={() => onRemoveAssignment(a)}
                                />
                              ))
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 px-4 py-3">
        {legendShifts.map((shift) => {
          const style = shiftChipStyle(shift.color);
          return (
            <div key={shift.id} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: shift.color }}
              />
              <span className="font-medium text-slate-700">{shift.name}</span>
              <span className="text-slate-400">
                {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
              </span>
              <span
                className="rounded px-1.5 py-0.5 text-[10px] font-semibold"
                style={{ background: style.background, color: style.color }}
              >
                {formatHoursShort(
                  shift.total_minutes ||
                    minutesBetween(shift.start_time, shift.end_time),
                )}
              </span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 text-xs">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="font-medium text-slate-700">OFF</span>
          <span className="text-slate-400">Nghỉ</span>
        </div>
      </div>
    </div>
  );
}
