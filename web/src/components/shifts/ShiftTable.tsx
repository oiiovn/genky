"use client";

import clsx from "clsx";
import {
  Copy,
  LayoutGrid,
  List,
  MoreHorizontal,
  Pencil,
  Search,
} from "lucide-react";
import type { Shift } from "@/lib/shifts-api";
import { formatDuration } from "@/lib/shifts-api";
import { ShiftIcon } from "@/components/shifts/ShiftIcon";

const tabs = [
  "Danh sách ca làm",
  "Lịch theo tuần",
  "Lịch theo tháng",
  "Phân ca tự động",
] as const;

export function ShiftTable({
  rows,
  total,
  page,
  lastPage,
  selectedId,
  search,
  statusFilter,
  activeTab,
  loading,
  onSearchChange,
  onSearchSubmit,
  onStatusFilterChange,
  onTabChange,
  onSelect,
  onEdit,
  onPageChange,
  onDuplicate,
}: {
  rows: Shift[];
  total: number;
  page: number;
  lastPage: number;
  selectedId: number | null;
  search: string;
  statusFilter: "" | "active" | "inactive";
  activeTab: (typeof tabs)[number];
  loading?: boolean;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
  onStatusFilterChange: (v: "" | "active" | "inactive") => void;
  onTabChange: (tab: (typeof tabs)[number]) => void;
  onSelect: (shift: Shift) => void;
  onEdit: (shift: Shift) => void;
  onPageChange: (p: number) => void;
  onDuplicate: (shift: Shift) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap gap-1 border-b border-slate-100 px-2 pt-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => onTabChange(tab)}
            className={clsx(
              "rounded-t-xl px-4 py-2.5 text-sm font-medium transition-colors",
              activeTab === tab
                ? "border-b-2 border-indigo-500 text-indigo-600"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearchSubmit()}
              placeholder="Tìm kiếm ca làm..."
              className="w-56 rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm outline-none focus:border-indigo-400 focus:bg-white"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              onStatusFilterChange(
                e.target.value as "" | "active" | "inactive",
              )
            }
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Không hoạt động</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-xl border border-indigo-200 bg-indigo-50 p-2 text-indigo-500"
            aria-label="Danh sách"
          >
            <List className="h-4 w-4" />
          </button>
          <button
            type="button"
            className="rounded-xl border border-slate-200 p-2 text-slate-400"
            aria-label="Lưới"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
        </div>
      </div>

      {activeTab !== "Danh sách ca làm" ? (
        <div className="px-5 py-16 text-center text-sm text-slate-400">
          Tab &quot;{activeTab}&quot; sẽ bổ sung khi có module phân ca.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs tracking-wide text-slate-400 uppercase">
                  <th className="px-5 py-3 font-medium">Tên ca</th>
                  <th className="px-3 py-3 font-medium">Thời gian</th>
                  <th className="px-3 py-3 font-medium">Thời lượng</th>
                  <th className="px-3 py-3 font-medium">Giờ nghỉ</th>
                  <th className="px-3 py-3 font-medium">Màu sắc</th>
                  <th className="px-3 py-3 font-medium">Số nhân viên</th>
                  <th className="px-3 py-3 font-medium">Trạng thái</th>
                  <th className="px-3 py-3 font-medium">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-12 text-center text-slate-400"
                    >
                      Đang tải...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-5 py-12 text-center text-slate-400"
                    >
                      Không tìm thấy ca làm.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => onSelect(row)}
                      className={clsx(
                        "cursor-pointer border-b border-slate-50 last:border-0 hover:bg-slate-50/70",
                        selectedId === row.id && "bg-indigo-50/50",
                      )}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-9 w-9 items-center justify-center rounded-xl"
                            style={{ backgroundColor: `${row.color}22` }}
                          >
                            <ShiftIcon icon={row.icon} color={row.color} />
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800">
                              {row.name}
                            </p>
                            <p className="text-xs text-slate-400">{row.code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {row.start_time} - {row.end_time}
                        {row.crosses_midnight && (
                          <span className="ml-1 text-xs text-indigo-500">
                            +1
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {formatDuration(row.duration_minutes)}
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {row.break_minutes}m
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-3.5 w-3.5 rounded-full"
                            style={{ backgroundColor: row.color }}
                          />
                          <span className="font-mono text-xs text-slate-500">
                            {row.color}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-slate-600">
                        {row.employee_count} nhân viên
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={clsx(
                            "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                            row.status === "active"
                              ? "bg-emerald-50 text-emerald-600"
                              : "bg-slate-100 text-slate-500",
                          )}
                        >
                          {row.status === "active"
                            ? "Đang hoạt động"
                            : "Không hoạt động"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div
                          className="flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => onEdit(row)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-500"
                            aria-label="Sửa"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDuplicate(row)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                            aria-label="Sao chép"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                            aria-label="Thêm"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
            <p>
              Hiển thị {rows.length} trên tổng số {total} ca làm
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
        </>
      )}
    </section>
  );
}

