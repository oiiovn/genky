"use client";

import { X } from "lucide-react";
import type { Employee } from "@/lib/employees-api";
import type { UnderstaffedSlot } from "@/lib/schedule-alerts";
import { formatDisplayDate, shiftChipStyle } from "@/lib/schedule-utils";
import { EmployeeAvatar } from "@/components/ui/EmployeeAvatar";

export type ScheduleAlertKind = "unscheduled" | "understaffed";

export function ScheduleAlertDetailPanel({
  kind,
  understaffedSlots,
  unscheduledEmployees,
  onClose,
  onViewDay,
  onSelectEmployee,
}: {
  kind: ScheduleAlertKind;
  understaffedSlots: UnderstaffedSlot[];
  unscheduledEmployees: Employee[];
  onClose: () => void;
  onViewDay: (date: string) => void;
  onSelectEmployee: (employeeId: number) => void;
}) {
  const title =
    kind === "understaffed"
      ? "Ca chưa đủ nhân sự"
      : "Nhân viên chưa có lịch";

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
            <p className="text-sm text-slate-500">
              {kind === "understaffed"
                ? `${understaffedSlots.length} ca thiếu người`
                : `${unscheduledEmployees.length} nhân viên`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {kind === "understaffed" ? (
            understaffedSlots.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
                Không có ca thiếu người trong khoảng này.
              </p>
            ) : (
              <ul className="space-y-2">
                {understaffedSlots.map((slot) => {
                  const style = shiftChipStyle(slot.shiftColor);
                  return (
                    <li
                      key={slot.key}
                      className="rounded-xl border border-slate-100 px-3 py-3"
                    >
                      <p className="text-sm font-semibold text-slate-800">
                        {formatDisplayDate(slot.date)}/{slot.date.slice(0, 4)} ·{" "}
                        {slot.branchName}
                      </p>
                      <div
                        className="mt-1.5 inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold"
                        style={style}
                      >
                        {slot.shiftName}
                      </div>
                      <p className="mt-2 text-sm text-slate-600">
                        {slot.assigned} / {slot.capacity} người ·{" "}
                        <span className="font-semibold text-rose-600">
                          Thiếu {slot.missing}
                        </span>
                      </p>
                      <button
                        type="button"
                        onClick={() => onViewDay(slot.date)}
                        className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        Xem ngày
                      </button>
                    </li>
                  );
                })}
              </ul>
            )
          ) : unscheduledEmployees.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
              Không có nhân viên chưa có lịch.
            </p>
          ) : (
            <ul className="space-y-2">
              {unscheduledEmployees.map((employee) => (
                <li key={employee.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEmployee(employee.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5 text-left hover:bg-slate-50"
                  >
                    <EmployeeAvatar
                      avatar={employee.avatar}
                      name={employee.full_name}
                      code={employee.employee_code}
                      className="h-9 w-9 rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {employee.full_name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {employee.employee_code}
                        {employee.branches.length > 0
                          ? ` · ${employee.branches.map((b) => b.name).join(", ")}`
                          : ""}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
