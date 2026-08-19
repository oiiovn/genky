"use client";

import clsx from "clsx";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileSpreadsheet,
  Printer,
  Settings2,
  Users,
} from "lucide-react";
import type { Branch } from "@/lib/api";
import type { Employee } from "@/lib/employees-api";
import type { ScheduleAssignment } from "@/lib/schedule-api";
import type { Shift } from "@/lib/shifts-api";
import { EmployeeAvatar } from "@/components/ui/EmployeeAvatar";
import { ScheduleMonthGrid } from "@/components/schedule/ScheduleMonthGrid";
import type { WeekOverview } from "@/components/schedule/ScheduleSidePanel";
import type { ScheduleRow } from "@/components/schedule/ScheduleWeekGrid";
import type { ScheduleViewMode } from "@/components/schedule/ScheduleToolbar";
import {
  formatHoursMinutes,
  formatHoursShort,
  formatMonthLabel,
  formatRangeLabel,
  minutesBetween,
  shiftChipStyle,
  type MonthDay,
  type WeekDay,
} from "@/lib/schedule-utils";
import { leaveChipStyle } from "@/lib/schedule-leave";

function hhmm(value: string) {
  return value.slice(0, 5);
}

function EmptyCalendarArt() {
  return (
    <svg
      viewBox="0 0 168 118"
      className="mx-auto h-[96px] w-[148px]"
      aria-hidden
    >
      <rect x="14" y="16" width="92" height="82" rx="12" fill="#EAF2FF" />
      <rect x="14" y="16" width="92" height="24" rx="12" fill="#C5DBFF" />
      <rect x="14" y="28" width="92" height="12" fill="#C5DBFF" />
      <circle cx="34" cy="28" r="3.5" fill="#2B63E1" />
      <circle cx="50" cy="28" r="3.5" fill="#2B63E1" />
      <rect x="28" y="52" width="16" height="12" rx="2.5" fill="#9EC2FF" />
      <rect x="50" y="52" width="16" height="12" rx="2.5" fill="#9EC2FF" />
      <rect x="72" y="52" width="16" height="12" rx="2.5" fill="#9EC2FF" />
      <rect x="28" y="72" width="16" height="12" rx="2.5" fill="#C5DBFF" />
      <rect x="50" y="72" width="16" height="12" rx="2.5" fill="#2B63E1" />
      <circle cx="124" cy="64" r="30" fill="#E0ECFF" />
      <circle cx="124" cy="52" r="12" fill="#5B8DEF" />
      <path d="M99 96c5-18 16-27 25-27s20 9 25 27" fill="#9EC2FF" />
    </svg>
  );
}

function EmptyBellArt() {
  return (
    <svg viewBox="0 0 72 72" className="h-14 w-14" aria-hidden>
      <circle cx="36" cy="36" r="34" fill="#F1F5F9" />
      <path
        d="M36 16c-8 0-14 6.2-14 14v8.2c0 2.4-.8 4.7-2.2 6.6L17 48h38l-2.8-3.2A10 10 0 0 1 50 38.2V30c0-7.8-6-14-14-14Z"
        fill="#CBD5E1"
      />
      <path d="M30 50a6 6 0 0 0 12 0" fill="#94A3B8" />
    </svg>
  );
}

export function MobileSchedule({
  view,
  onViewChange,
  rangeFrom,
  rangeTo,
  rangeAnchor,
  onPrev,
  onNext,
  onToday,
  refreshing,
  branches,
  shifts,
  employees,
  branchId,
  shiftId,
  employeeId,
  onBranchChange,
  onShiftChange,
  onEmployeeChange,
  weekDays,
  rows,
  monthGrid,
  monthByDate,
  monthLeavesByDate,
  selectedDate,
  loading,
  onCellClick,
  onRemoveAssignment,
  onDayClick,
  overview,
  emptyAlertLabel,
  onQuickAction,
  onViewAlertDetail,
  assignments,
}: {
  view: ScheduleViewMode;
  onViewChange: (v: ScheduleViewMode) => void;
  rangeFrom: string;
  rangeTo: string;
  rangeAnchor: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  refreshing?: boolean;
  branches: Branch[];
  shifts: Shift[];
  employees: Employee[];
  branchId: number | "";
  shiftId: number | "";
  employeeId: number | "";
  onBranchChange: (v: number | "") => void;
  onShiftChange: (v: number | "") => void;
  onEmployeeChange: (v: number | "") => void;
  weekDays: WeekDay[];
  rows: ScheduleRow[];
  monthGrid: MonthDay[];
  monthByDate: Record<string, ScheduleAssignment[]>;
  monthLeavesByDate?: Record<string, { label: string; count: number; type?: string }[]>;
  selectedDate: string | null;
  loading?: boolean;
  onCellClick: (employee: Employee, dayIso: string) => void;
  onRemoveAssignment: (assignment: ScheduleAssignment) => void;
  onDayClick: (iso: string) => void;
  overview: WeekOverview;
  emptyAlertLabel: string;
  onQuickAction: (action: string) => void;
  onViewAlertDetail?: (kind: "unscheduled" | "understaffed") => void;
  assignments: ScheduleAssignment[];
}) {
  const rangeLabel =
    view === "month"
      ? formatMonthLabel(rangeAnchor)
      : formatRangeLabel(rangeFrom, rangeTo);

  const alerts = [
    overview.unscheduledEmployees > 0
      ? {
          id: "unscheduled" as const,
          title: `${overview.unscheduledEmployees} nhân viên chưa có lịch`,
        }
      : null,
    !overview.understaffedHidden && overview.understaffedShifts > 0
      ? {
          id: "understaffed" as const,
          title: `${overview.understaffedShifts} ca chưa đủ nhân sự`,
        }
      : null,
  ].filter(Boolean) as { id: "unscheduled" | "understaffed"; title: string }[];

  const actions = [
    {
      id: "bulk",
      label: "Xếp ca hàng loạt",
      icon: Users,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      id: "copy",
      label: "Sao chép lịch",
      icon: CalendarPlus,
      tone: "bg-violet-50 text-violet-600",
    },
    {
      id: "export",
      label: "Xuất Excel",
      icon: FileSpreadsheet,
      tone: "bg-emerald-50 text-emerald-600",
    },
    {
      id: "print",
      label: "In lịch làm việc",
      icon: Printer,
      tone: "bg-sky-50 text-sky-600",
    },
  ];

  const empty = rows.length === 0 && !loading;

  return (
    <main className="space-y-3.5 px-3.5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-tight font-bold text-slate-900">
            Lịch làm việc
          </h1>
          <p className="mt-1 text-[12px] leading-snug text-slate-400">
            Quản lý và phân công lịch làm việc cho nhân viên
          </p>
        </div>
        <button
          type="button"
          className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-500"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Tùy chọn
        </button>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex min-w-0 flex-1 items-center rounded-lg border border-slate-200 bg-white">
          <button
            type="button"
            onClick={onPrev}
            className="px-1.5 py-2 text-slate-400"
            aria-label="Trước"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToday}
            className="flex min-w-0 flex-1 items-center justify-center gap-1 py-2 text-[11px] font-semibold text-slate-700"
          >
            <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
            <span className="truncate">{rangeLabel}</span>
          </button>
          <button
            type="button"
            onClick={onNext}
            className="px-1.5 py-2 text-slate-400"
            aria-label="Sau"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {refreshing ? (
            <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-blue-500" />
          ) : null}
        </div>

        <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5">
          {(
            [
              ["week", "Tuần"],
              ["month", "Tháng"],
              ["list", "Danh sách"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => onViewChange(id)}
              className={clsx(
                "rounded-md px-2 py-1.5 text-[11px] font-semibold",
                view === id
                  ? "bg-[#2B63E1] text-white shadow-sm"
                  : "text-slate-400",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {(
          [
            [branchId, onBranchChange, "Tất cả chi nhánh", branches.map((b) => [b.id, b.name] as const)],
            [shiftId, onShiftChange, "Tất cả ca", shifts.map((s) => [s.id, s.name] as const)],
            [
              employeeId,
              onEmployeeChange,
              "Tất cả nhân viên",
              employees.map((e) => [e.id, e.full_name] as const),
            ],
          ] as const
        ).map(([value, onChange, placeholder, options], i) => (
          <select
            key={i}
            value={value === "" ? "" : String(value)}
            onChange={(e) =>
              onChange(e.target.value ? Number(e.target.value) : "")
            }
            className="h-9 w-full appearance-none truncate rounded-lg border border-slate-200 bg-white bg-[length:10px] bg-[right_8px_center] bg-no-repeat px-2 pr-6 text-[10px] text-slate-600"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'><polyline points='6 9 12 15 18 9'/></svg>\")",
            }}
          >
            <option value="">{placeholder}</option>
            {options.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        ))}
      </div>

      {view === "week" ? (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className={clsx("overflow-x-auto", empty && "overflow-x-hidden")}>
            <table
              className={clsx(
                "w-full border-collapse text-left",
                empty ? "table-fixed" : "min-w-[560px]",
              )}
            >
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="sticky left-0 z-10 w-[22%] border-r border-slate-100 bg-white px-2 py-2.5 text-[10px] font-semibold text-slate-500">
                    Nhân viên
                  </th>
                  {weekDays.map((day) => (
                    <th
                      key={day.iso}
                      className={clsx(
                        "border-r border-slate-100 px-0.5 py-2.5 text-center text-[9px] leading-tight font-semibold whitespace-nowrap last:border-r-0",
                        day.isToday ? "text-[#2B63E1]" : "text-slate-400",
                      )}
                    >
                      {day.label} {day.monthDay}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-14 text-center text-sm text-slate-400">
                      Đang tải...
                    </td>
                  </tr>
                ) : empty ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center">
                      <EmptyCalendarArt />
                      <p className="mt-2 text-[12px] text-slate-400">
                        Chưa có nhân viên để hiển thị lịch.
                      </p>
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.employee.id}
                      className="border-t border-slate-50"
                    >
                      <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-2 py-2">
                        <div className="flex min-w-[108px] items-center gap-1.5">
                          <EmployeeAvatar
                            avatar={row.employee.avatar}
                            name={row.employee.full_name}
                            code={row.employee.employee_code}
                            className="h-7 w-7 rounded-full"
                          />
                          <p className="truncate text-[11px] font-semibold text-slate-800">
                            {row.employee.full_name}
                          </p>
                        </div>
                      </td>
                      {weekDays.map((day) => {
                        const cells = row.byDate[day.iso] ?? [];
                        const leave = row.leavesByDate?.[day.iso];
                        const first = cells[0]?.shift;
                        const style = leave
                          ? leaveChipStyle(leave.type)
                          : first
                            ? shiftChipStyle(first.color)
                            : null;
                        return (
                          <td key={day.iso} className="border-r border-slate-50 px-0.5 py-1 last:border-r-0">
                            <button
                              type="button"
                              onClick={() =>
                                onCellClick(row.employee, day.iso)
                              }
                              onContextMenu={(e) => {
                                e.preventDefault();
                                if (!leave && cells[0]) onRemoveAssignment(cells[0]);
                              }}
                              className="flex h-9 w-full items-center justify-center rounded-md"
                              style={
                                style
                                  ? {
                                      background: style.background,
                                      color: style.color,
                                    }
                                  : undefined
                              }
                            >
                              <span className="max-w-full truncate px-0.5 text-[9px] font-semibold" title={leave ? leave.label : undefined}>
                                {leave
                                  ? leave.label
                                  : first
                                    ? first.code || first.name
                                    : "OFF"}
                              </span>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : view === "month" ? (
        <ScheduleMonthGrid
          days={monthGrid}
          byDate={monthByDate}
          leavesByDate={monthLeavesByDate}
          selectedDate={selectedDate}
          loading={loading}
          refreshing={refreshing}
          onDayClick={onDayClick}
        />
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {assignments.length === 0 ? (
            <div className="px-3 py-10 text-center">
              <EmptyCalendarArt />
              <p className="mt-2 text-[12px] text-slate-400">
                Chưa có phân ca trong khoảng này.
              </p>
            </div>
          ) : (
            <ul>
              {assignments.map((a) => (
                <li
                  key={a.id}
                  className="border-b border-slate-50 px-3 py-3 last:border-0"
                >
                  <p className="text-sm font-semibold text-slate-800">
                    {a.employee?.full_name ?? "—"}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {a.date} · {a.shift?.name ?? "—"} ·{" "}
                    {a.shift
                      ? `${a.shift.start_time} - ${a.shift.end_time}`
                      : "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <div className="-mx-3.5 flex gap-2 overflow-x-auto px-3.5 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {shifts.map((shift) => (
          <article
            key={shift.id}
            className="flex min-w-[118px] items-start gap-2 rounded-xl border border-slate-100 bg-white px-2.5 py-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <span
              className="mt-0.5 h-4 w-4 shrink-0 rounded"
              style={{ backgroundColor: shift.color }}
            />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-slate-800">
                {shift.name}
              </p>
              <p className="text-[10px] text-slate-400">
                {hhmm(shift.start_time)} - {hhmm(shift.end_time)}
              </p>
              <p className="text-[10px] font-semibold text-slate-500">
                {formatHoursShort(
                  shift.total_minutes ||
                    minutesBetween(shift.start_time, shift.end_time),
                )}
              </p>
            </div>
          </article>
        ))}
        <article className="flex min-w-[88px] items-start gap-2 rounded-xl border border-slate-100 bg-white px-2.5 py-2">
          <span className="mt-0.5 h-4 w-4 shrink-0 rounded bg-violet-500" />
          <div>
            <p className="text-[11px] font-semibold text-slate-800">Nghỉ phép năm</p>
          </div>
        </article>
        <article className="flex min-w-[88px] items-start gap-2 rounded-xl border border-slate-100 bg-white px-2.5 py-2">
          <span className="mt-0.5 h-4 w-4 shrink-0 rounded bg-sky-500" />
          <div>
            <p className="text-[11px] font-semibold text-slate-800">Việc riêng</p>
          </div>
        </article>
        <article className="flex min-w-[88px] items-start gap-2 rounded-xl border border-slate-100 bg-white px-2.5 py-2">
          <span className="mt-0.5 h-4 w-4 shrink-0 rounded bg-slate-200" />
          <div>
            <p className="text-[11px] font-semibold text-slate-800">OFF</p>
            <p className="text-[10px] text-slate-400">Nghỉ</p>
          </div>
        </article>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="text-[13px] font-bold text-slate-800">
            {view === "month" ? "Tổng quan tháng" : "Tổng quan tuần"}
          </h2>
          <div className="mt-2.5 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                Tổng số ca
              </span>
              <span className="font-semibold text-slate-800">
                {overview.totalAssignments} ca làm
              </span>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                Tổng giờ
              </span>
              <span className="font-semibold text-slate-800">
                {formatHoursMinutes(overview.totalMinutes)}
              </span>
            </div>
            {overview.byShift.map(({ shift, count }) => (
              <div
                key={shift.id}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="inline-flex items-center gap-1.5 text-slate-500">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ backgroundColor: shift.color }}
                  />
                  {shift.name}
                </span>
                <span className="font-semibold text-slate-800">{count}</span>
              </div>
            ))}
            <div className="flex items-center justify-between text-[11px]">
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <span className="h-2.5 w-2.5 rounded-sm bg-slate-200" />
                OFF
              </span>
              <span className="font-semibold text-slate-800">
                {overview.offDays}
              </span>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <h2 className="text-[13px] font-bold text-slate-800">Thông báo</h2>
          {alerts.length === 0 ? (
            <div className="mt-5 flex flex-col items-center text-center">
              <EmptyBellArt />
              <p className="mt-2 text-[11px] leading-snug text-slate-400">
                {emptyAlertLabel}
              </p>
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {alerts.map((a) => (
                <li key={a.id}>
                  <p className="text-xs font-medium text-slate-700">{a.title}</p>
                  <button
                    type="button"
                    onClick={() => onViewAlertDetail?.(a.id)}
                    className="mt-0.5 text-[11px] font-semibold text-[#2B63E1]"
                  >
                    Xem chi tiết
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section>
        <h2 className="mb-2 text-[13px] font-bold text-slate-800">
          Lịch làm việc nhanh
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {actions.map(({ id, label, icon: Icon, tone }) => (
            <button
              key={id}
              type="button"
              onClick={() => onQuickAction(id)}
              className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-100 bg-white px-1 py-2.5 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <span
                className={clsx(
                  "flex h-9 w-9 items-center justify-center rounded-lg",
                  tone,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-[9px] leading-tight font-medium text-slate-600">
                {label}
              </span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
