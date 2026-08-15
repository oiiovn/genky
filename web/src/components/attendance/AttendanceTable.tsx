"use client";

import clsx from "clsx";
import { Search } from "lucide-react";
import type {
  AttendanceRow,
  AttendanceUiStatus,
} from "@/lib/attendance-api";
import {
  statusLabel,
  statusTone,
} from "@/lib/attendance-api";
import { AttendanceRowActions } from "@/components/attendance/AttendanceRowActions";

export function AttendanceTable({
  rows,
  total,
  page,
  lastPage,
  search,
  dateFrom,
  dateTo,
  branchFilter,
  shiftFilter,
  statusFilter,
  branches,
  shifts,
  loading,
  onSearchChange,
  onSearchSubmit,
  onDateFromChange,
  onDateToChange,
  onBranchChange,
  onShiftChange,
  onStatusChange,
  onPageChange,
  onView,
  onEdit,
  onDelete,
}: {
  rows: AttendanceRow[];
  total: number;
  page: number;
  lastPage: number;
  search: string;
  dateFrom: string;
  dateTo: string;
  branchFilter: string;
  shiftFilter: string;
  statusFilter: "" | AttendanceUiStatus;
  branches: { id: string; name: string }[];
  shifts: { id: string; name: string }[];
  loading?: boolean;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onBranchChange: (v: string) => void;
  onShiftChange: (v: string) => void;
  onStatusChange: (v: "" | AttendanceUiStatus) => void;
  onPageChange: (p: number) => void;
  onView: (row: AttendanceRow) => void;
  onEdit?: (row: AttendanceRow) => void;
  onDelete?: (row: AttendanceRow) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
          aria-label="Từ ngày"
        />
        <span className="text-xs text-slate-400">→</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
          aria-label="Đến ngày"
        />
        <select
          value={branchFilter}
          onChange={(e) => onBranchChange(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
        >
          <option value="">Tất cả chi nhánh</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={shiftFilter}
          onChange={(e) => onShiftChange(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
        >
          <option value="">Tất cả ca</option>
          {shifts.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            onStatusChange(e.target.value as "" | AttendanceUiStatus)
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
        >
          <option value="">Tất cả trạng thái</option>
          <option value="checked_out">Đã check-out</option>
          <option value="working">Đang làm việc</option>
          <option value="not_checked_in">Chưa check-in</option>
          <option value="on_leave">Nghỉ phép</option>
          <option value="absent">Vắng mặt</option>
        </select>

        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onSearchSubmit()}
            placeholder="Tìm kiếm nhân viên..."
            className="w-52 rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm outline-none focus:border-indigo-400 focus:bg-white"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs tracking-wide text-slate-400 uppercase">
              <th className="px-4 py-3 font-medium">Nhân viên</th>
              <th className="px-3 py-3 font-medium">Ngày</th>
              <th className="px-3 py-3 font-medium">Ca làm</th>
              <th className="px-3 py-3 font-medium">Check-in</th>
              <th className="px-3 py-3 font-medium">Check-out</th>
              <th className="px-3 py-3 font-medium">Tổng giờ</th>
              <th className="px-3 py-3 font-medium">Trạng thái</th>
              <th className="px-3 py-3 font-medium">Chi nhánh</th>
              <th className="px-3 py-3 font-medium">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                  Đang tải...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-5 py-12 text-center text-slate-400">
                  Không có dữ liệu chấm công.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id ?? `${row.employee_id}-${row.work_date}`}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          row.avatar ||
                          `https://i.pravatar.cc/80?u=${encodeURIComponent(row.employee_code)}`
                        }
                        alt=""
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-semibold text-slate-800">
                          {row.full_name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {row.employee_code} · {row.position}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {row.work_date
                      ? row.work_date.split("-").reverse().join("/")
                      : "—"}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-700">{row.shift_name}</p>
                    <p className="text-xs text-slate-400">{row.shift_time}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-700">
                      {row.check_in ?? "—"}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium text-slate-700">
                      {row.check_out ?? "—"}
                    </p>
                  </td>
                  <td className="px-3 py-3 font-medium text-slate-700">
                    {row.total_hours ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={clsx(
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                        statusTone[row.ui_status],
                      )}
                    >
                      {row.ui_status === "on_leave" && row.leave_type_label
                        ? row.leave_type_label
                        : statusLabel[row.ui_status]}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {row.branch_name ?? "—"}
                  </td>
                  <td className="px-3 py-3">
                    <AttendanceRowActions
                      row={row}
                      onView={onView}
                      onEdit={onEdit}
                      onDelete={onDelete}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
        <p>
          Hiển thị {rows.length} trên tổng số {total} bản ghi
        </p>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.max(lastPage, 1) }, (_, i) => i + 1)
            .slice(0, 7)
            .map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPageChange(p)}
                className={clsx(
                  "h-8 min-w-8 rounded-lg px-2 text-sm font-medium",
                  p === page
                    ? "bg-indigo-500 text-white"
                    : "text-slate-500 hover:bg-slate-100",
                )}
              >
                {p}
              </button>
            ))}
        </div>
      </div>
    </section>
  );
}
