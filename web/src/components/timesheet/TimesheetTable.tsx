"use client";

import clsx from "clsx";
import {
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { shiftChipStyle } from "@/lib/schedule-utils";
import {
  formatHours,
  type TimesheetRow,
  type TimesheetStatus,
} from "@/lib/timesheet";
import { EmployeeAvatar } from "@/components/ui/EmployeeAvatar";

export type TimesheetTab =
  | "all"
  | "branch"
  | "department"
  | "shift";

export function TimesheetTable({
  rows,
  total,
  page,
  lastPage,
  perPage,
  selectedIds,
  loading,
  tab,
  search,
  branchFilter,
  departmentFilter,
  shiftFilter,
  statusFilter,
  branches,
  departments,
  shifts,
  onTabChange,
  onSearchChange,
  onBranchChange,
  onDepartmentChange,
  onShiftChange,
  onStatusChange,
  onToggleRow,
  onToggleAll,
  onPageChange,
  onPerPageChange,
}: {
  rows: TimesheetRow[];
  total: number;
  page: number;
  lastPage: number;
  perPage: number;
  selectedIds: number[];
  loading?: boolean;
  tab: TimesheetTab;
  search: string;
  branchFilter: number | "";
  departmentFilter: string;
  shiftFilter: number | "";
  statusFilter: "" | TimesheetStatus;
  branches: { id: number; name: string }[];
  departments: string[];
  shifts: { id: number; name: string }[];
  onTabChange: (t: TimesheetTab) => void;
  onSearchChange: (v: string) => void;
  onBranchChange: (v: number | "") => void;
  onDepartmentChange: (v: string) => void;
  onShiftChange: (v: number | "") => void;
  onStatusChange: (v: "" | TimesheetStatus) => void;
  onToggleRow: (id: number) => void;
  onToggleAll: () => void;
  onPageChange: (p: number) => void;
  onPerPageChange: (n: number) => void;
  onApprove: (id: number) => void;
}) {
  const tabs: { id: TimesheetTab; label: string }[] = [
    { id: "all", label: "Tất cả" },
    { id: "branch", label: "Theo chi nhánh" },
    { id: "department", label: "Theo phòng ban" },
    { id: "shift", label: "Theo ca làm" },
  ];

  const allSelected =
    rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));

  const totals = rows.reduce(
    (acc, r) => {
      acc.work_days += r.work_days;
      acc.work_minutes += r.work_minutes;
      acc.ot_minutes += r.ot_minutes;
      acc.leave_days += r.leave_days;
      acc.other_leave_days += r.other_leave_days;
      acc.total_days += r.total_days;
      return acc;
    },
    {
      work_days: 0,
      work_minutes: 0,
      ot_minutes: 0,
      leave_days: 0,
      other_leave_days: 0,
      total_days: 0,
    },
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-3 border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabChange(t.id)}
                className={clsx(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold transition",
                  tab === t.id
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-500 hover:text-slate-700",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={branchFilter === "" ? "" : String(branchFilter)}
            onChange={(e) =>
              onBranchChange(e.target.value ? Number(e.target.value) : "")
            }
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
          >
            <option value="">Chi nhánh</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={departmentFilter}
            onChange={(e) => onDepartmentChange(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
          >
            <option value="">Phòng ban</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>

          <select
            value={shiftFilter === "" ? "" : String(shiftFilter)}
            onChange={(e) =>
              onShiftChange(e.target.value ? Number(e.target.value) : "")
            }
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
          >
            <option value="">Ca làm</option>
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              onStatusChange(e.target.value as "" | TimesheetStatus)
            }
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
          >
            <option value="">Trạng thái</option>
            <option value="approved">Đã duyệt</option>
            <option value="pending">Chờ duyệt</option>
          </select>

          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm kiếm nhân viên..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-indigo-400"
            />
          </div>

          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Bộ lọc
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1100px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              <th className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
              </th>
              <th className="px-2 py-3">#</th>
              <th className="px-3 py-3">Nhân viên</th>
              <th className="px-3 py-3">Phòng ban</th>
              <th className="px-3 py-3">Ca làm</th>
              <th className="px-3 py-3 text-right">Ngày công</th>
              <th className="px-3 py-3 text-right">Giờ làm</th>
              <th className="px-3 py-3 text-right">Giờ OT</th>
              <th className="px-3 py-3 text-right">Nghỉ phép</th>
              <th className="px-3 py-3 text-right">Nghỉ khác</th>
              <th className="px-3 py-3 text-right">Tổng công</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-4 py-16 text-center text-slate-400"
                >
                  Đang tải bảng công...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-4 py-16 text-center text-slate-400"
                >
                  Chưa có dữ liệu bảng công trong tháng này.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => onToggleRow(row.id)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                      />
                    </td>
                    <td className="px-2 py-3 text-slate-500">
                      {(page - 1) * perPage + index + 1}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <EmployeeAvatar
                          avatar={row.employee.avatar}
                          name={row.employee.full_name}
                          code={row.employee.employee_code}
                          className="h-9 w-9 rounded-full"
                        />
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">
                            {row.employee.full_name}
                          </p>
                          <p className="text-xs text-slate-400">
                            {row.employee.employee_code}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {row.department}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex max-w-[220px] flex-wrap gap-1">
                        {row.shifts.length === 0 ? (
                          <span className="text-xs text-slate-400">—</span>
                        ) : (
                          row.shifts.slice(0, 3).map((s) => {
                            const chip = shiftChipStyle(s.color);
                            return (
                              <span
                                key={s.id}
                                className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                                style={chip}
                                title={`${s.start_time} - ${s.end_time}`}
                              >
                                {s.name}
                              </span>
                            );
                          })
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right font-medium text-slate-700">
                      {row.work_days}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {formatHours(row.work_minutes)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {formatHours(row.ot_minutes)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {row.leave_days}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      {row.other_leave_days}
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-slate-800">
                      {row.total_days}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">
                <td colSpan={5} className="px-3 py-3">
                  Tổng cộng (trang này)
                </td>
                <td className="px-3 py-3 text-right">{totals.work_days}</td>
                <td className="px-3 py-3 text-right">
                  {formatHours(totals.work_minutes)}
                </td>
                <td className="px-3 py-3 text-right">
                  {formatHours(totals.ot_minutes)}
                </td>
                <td className="px-3 py-3 text-right">{totals.leave_days}</td>
                <td className="px-3 py-3 text-right">
                  {totals.other_leave_days}
                </td>
                <td className="px-3 py-3 text-right">{totals.total_days}</td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
        <p>
          Hiển thị {rows.length} trên tổng số {total} nhân viên
        </p>
        <div className="flex items-center gap-2">
          <select
            value={perPage}
            onChange={(e) => onPerPageChange(Number(e.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm"
          >
            {[10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}/trang
              </option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(lastPage, 5) }, (_, i) => i + 1).map(
              (p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={clsx(
                    "h-8 min-w-8 rounded-lg px-2 text-sm font-medium",
                    page === p
                      ? "bg-indigo-500 text-white"
                      : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {p}
                </button>
              ),
            )}
            {lastPage > 5 ? (
              <span className="px-1 text-slate-400">…</span>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
