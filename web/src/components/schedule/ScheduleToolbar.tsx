"use client";

import clsx from "clsx";
import {
  ChevronLeft,
  ChevronRight,
  Settings2,
  SlidersHorizontal,
} from "lucide-react";
import type { Branch } from "@/lib/api";
import type { Employee } from "@/lib/employees-api";
import type { Shift } from "@/lib/shifts-api";
import { formatRangeLabel } from "@/lib/schedule-utils";

export type ScheduleViewMode = "week" | "month" | "list";

export function ScheduleToolbar({
  view,
  onViewChange,
  rangeFrom,
  rangeTo,
  onPrev,
  onNext,
  onToday,
  branches,
  shifts,
  employees,
  branchId,
  shiftId,
  employeeId,
  search,
  refreshing,
  onBranchChange,
  onShiftChange,
  onEmployeeChange,
  onSearchChange,
}: {
  view: ScheduleViewMode;
  onViewChange: (v: ScheduleViewMode) => void;
  rangeFrom: string;
  rangeTo: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  branches: Branch[];
  shifts: Shift[];
  employees: Employee[];
  branchId: number | "";
  shiftId: number | "";
  employeeId: number | "";
  search: string;
  refreshing?: boolean;
  onBranchChange: (v: number | "") => void;
  onShiftChange: (v: number | "") => void;
  onEmployeeChange: (v: number | "") => void;
  onSearchChange: (v: string) => void;
}) {
  const tabs: { id: ScheduleViewMode; label: string }[] = [
    { id: "week", label: "Tuần" },
    { id: "month", label: "Tháng" },
    { id: "list", label: "Danh sách" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Lịch làm việc</h2>
          <p className="text-sm text-slate-500">
            Quản lý và phân công lịch làm việc cho nhân viên
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
          >
            <Settings2 className="h-4 w-4" />
            Tùy chọn
          </button>
          <div className="relative inline-flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
            <button
              type="button"
              onClick={onPrev}
              className="px-2.5 py-2 text-slate-500 hover:bg-slate-50"
              aria-label="Tuần trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToday}
              className="border-x border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {formatRangeLabel(rangeFrom, rangeTo)}
            </button>
            <button
              type="button"
              onClick={onNext}
              className="px-2.5 py-2 text-slate-500 hover:bg-slate-50"
              aria-label="Tuần sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {refreshing ? (
              <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 bg-indigo-400" />
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl bg-slate-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onViewChange(tab.id)}
              className={clsx(
                "rounded-lg px-3.5 py-1.5 text-sm font-semibold transition",
                view === tab.id
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select
          value={branchId === "" ? "" : String(branchId)}
          onChange={(e) =>
            onBranchChange(e.target.value ? Number(e.target.value) : "")
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
        >
          <option value="">Tất cả chi nhánh</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>

        <select
          value={shiftId === "" ? "" : String(shiftId)}
          onChange={(e) =>
            onShiftChange(e.target.value ? Number(e.target.value) : "")
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
        >
          <option value="">Tất cả ca</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={employeeId === "" ? "" : String(employeeId)}
          onChange={(e) =>
            onEmployeeChange(e.target.value ? Number(e.target.value) : "")
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-400"
        >
          <option value="">Tất cả nhân viên</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.full_name}
            </option>
          ))}
        </select>

        <div className="relative min-w-[220px] flex-1">
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm kiếm nhân viên..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-10 pl-3 text-sm outline-none focus:border-indigo-400"
          />
          <SlidersHorizontal className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      </div>
    </div>
  );
}
