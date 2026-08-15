"use client";

import { Plus, Trash2, X } from "lucide-react";
import type { ScheduleAssignment } from "@/lib/schedule-api";
import type { Employee } from "@/lib/employees-api";
import { formatDisplayDate, shiftChipStyle } from "@/lib/schedule-utils";

export function ScheduleDayPanel({
  date,
  assignments,
  employees,
  adding,
  selectedEmployeeId,
  onSelectedEmployeeChange,
  onClose,
  onStartAdd,
  onCancelAdd,
  onConfirmAdd,
  onRemove,
}: {
  date: string;
  assignments: ScheduleAssignment[];
  employees: Employee[];
  adding: boolean;
  selectedEmployeeId: number | "";
  onSelectedEmployeeChange: (id: number | "") => void;
  onClose: () => void;
  onStartAdd: () => void;
  onCancelAdd: () => void;
  onConfirmAdd: () => void;
  onRemove: (assignment: ScheduleAssignment) => void;
}) {
  const [, , day] = date.split("-");
  const titleDate = `${Number(day)} · ${formatDisplayDate(date)}/${date.slice(0, 4)}`;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-4 sm:items-center">
      <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              Lịch ngày {titleDate}
            </h3>
            <p className="text-sm text-slate-500">
              {assignments.length} phân ca ·{" "}
              {
                new Set(
                  assignments
                    .map((a) => a.employee?.id)
                    .filter((id): id is number => Boolean(id)),
                ).size
              }{" "}
              nhân viên
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
          {assignments.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-400">
              Chưa có phân ca trong ngày này.
            </p>
          ) : (
            <ul className="space-y-2">
              {assignments.map((a) => {
                const style = shiftChipStyle(a.shift?.color);
                return (
                  <li
                    key={a.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 px-3 py-2.5"
                  >
                    <div
                      className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5"
                      style={style}
                    >
                      <p className="truncate text-sm font-semibold">
                        {a.employee?.full_name ?? "—"}
                      </p>
                      <p className="truncate text-xs opacity-80">
                        {a.shift
                          ? `${a.shift.name} · ${a.shift.start_time} - ${a.shift.end_time}`
                          : "—"}
                        {a.branch?.name ? ` · ${a.branch.name}` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(a)}
                      className="rounded-lg p-2 text-rose-500 hover:bg-rose-50"
                      aria-label="Gỡ ca"
                      title="Gỡ ca"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {adding ? (
            <div className="mt-4 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
              <p className="text-sm font-medium text-slate-700">
                Chọn nhân viên để phân ca
              </p>
              <select
                value={selectedEmployeeId === "" ? "" : String(selectedEmployeeId)}
                onChange={(e) =>
                  onSelectedEmployeeChange(
                    e.target.value ? Number(e.target.value) : "",
                  )
                }
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              >
                <option value="">Chọn nhân viên</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} ({emp.employee_code})
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onCancelAdd}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
                >
                  Huỷ
                </button>
                <button
                  type="button"
                  disabled={!selectedEmployeeId}
                  onClick={onConfirmAdd}
                  className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Tiếp tục
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {!adding ? (
          <div className="border-t border-slate-100 px-5 py-4">
            <button
              type="button"
              onClick={onStartAdd}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-sm font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              Thêm lịch
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
