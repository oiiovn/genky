"use client";

import clsx from "clsx";
import {
  Eye,
  Pencil,
  Search,
  LayoutGrid,
  List,
  SlidersHorizontal,
  Trash2,
  UserPlus,
  BadgeCheck,
} from "lucide-react";
import type { Employee } from "@/lib/employees-api";

const positionTone: Record<string, string> = {
  "Quản lý": "bg-violet-50 text-violet-600",
  "Thu ngân": "bg-emerald-50 text-emerald-600",
  "Pha chế": "bg-sky-50 text-sky-600",
  "Phục vụ": "bg-amber-50 text-amber-600",
  "Bếp chính": "bg-blue-50 text-blue-600",
  "Phụ bếp": "bg-indigo-50 text-indigo-600",
  CTV: "bg-slate-100 text-slate-600",
};

const statusTone: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-600",
  inactive: "bg-amber-50 text-amber-600",
  resigned: "bg-rose-50 text-rose-600",
};

const statusLabel: Record<string, string> = {
  active: "Đang làm việc",
  inactive: "Tạm nghỉ",
  resigned: "Nghỉ việc",
};

function relativeJoined(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  const dd = date.toLocaleDateString("vi-VN");
  const months = Math.max(
    0,
    Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30)),
  );
  if (months <= 0) return `${dd} · mới vào`;
  if (months < 12) return `${dd} · ${months} tháng trước`;
  const years = Math.floor(months / 12);
  return `${dd} · ${years} năm trước`;
}

export function EmployeeTable({
  rows,
  total,
  page,
  lastPage,
  search,
  onSearchChange,
  onSearchSubmit,
  onPageChange,
  onEdit,
  onView,
  onDelete,
  onInvite,
  loading,
}: {
  rows: Employee[];
  total: number;
  page: number;
  lastPage: number;
  search: string;
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
  onPageChange: (p: number) => void;
  onEdit: (employee: Employee) => void;
  onView: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onInvite: (employee: Employee) => void;
  loading?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-800">
          Danh sách nhân viên ({total})
        </h2>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearchSubmit()}
              placeholder="Tìm kiếm nhân viên..."
              className="w-56 rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm outline-none focus:border-indigo-400 focus:bg-white"
            />
          </div>
          <button
            type="button"
            className="rounded-xl border border-slate-200 p-2 text-slate-400"
            aria-label="Lưới"
          >
            <LayoutGrid className="h-4 w-4" />
          </button>
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
            aria-label="Bộ lọc"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs tracking-wide text-slate-400 uppercase">
              <th className="px-4 py-3 font-medium">
                <input type="checkbox" className="rounded border-slate-300" />
              </th>
              <th className="px-3 py-3 font-medium">Mã NV</th>
              <th className="px-3 py-3 font-medium">Họ và tên</th>
              <th className="px-3 py-3 font-medium">Chức vụ</th>
              <th className="px-3 py-3 font-medium">Chi nhánh</th>
              <th className="px-3 py-3 font-medium">Ca làm việc</th>
              <th className="px-3 py-3 font-medium">Ngày vào làm</th>
              <th className="px-3 py-3 font-medium">Trạng thái</th>
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
                  Chưa có nhân viên. Bấm &quot;Thêm nhân viên&quot; để tạo mới.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const primary =
                  row.branches.find((b) => b.is_primary) ?? row.branches[0];
                const posName = row.position?.name ?? "—";
                const roleTone =
                  positionTone[posName] ?? "bg-slate-100 text-slate-600";
                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-slate-300"
                      />
                    </td>
                    <td className="px-3 py-3 font-medium text-slate-700">
                      {row.employee_code}
                    </td>
                    <td className="px-3 py-3">
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
                            {row.phone ?? "—"}
                          </p>
                          {row.has_user_account ? (
                            <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                              <BadgeCheck className="h-3 w-3" />
                              Đã có tài khoản
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[11px] font-medium text-amber-600">
                              Chưa có tài khoản
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={clsx(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          roleTone,
                        )}
                      >
                        {posName}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-slate-600">
                      {primary?.name ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-slate-400">—</td>
                    <td className="px-3 py-3 text-slate-600">
                      {relativeJoined(row.joined_at)}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={clsx(
                          "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                          statusTone[row.status] ?? "bg-slate-100 text-slate-600",
                        )}
                      >
                        {statusLabel[row.status] ?? row.status}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onView(row)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-500"
                          aria-label="Xem"
                          title="Xem nhân viên"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onEdit(row)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-500"
                          aria-label="Sửa"
                          title="Sửa nhân viên"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {!row.has_user_account && (
                          <button
                            type="button"
                            onClick={() => onInvite(row)}
                            className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-100"
                            aria-label="Mời tài khoản"
                            title="Mời tạo tài khoản"
                          >
                            <UserPlus className="h-3.5 w-3.5" />
                            Mời tài khoản
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDelete(row)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                          aria-label="Xóa"
                          title="Xóa nhân viên"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
        <p>
          Hiển thị {rows.length} trên tổng số {total} nhân viên
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
