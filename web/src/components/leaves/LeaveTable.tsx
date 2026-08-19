"use client";

import clsx from "clsx";
import { Check, Pencil, Search, Trash2, X } from "lucide-react";
import { EmployeeAvatar } from "@/components/ui/EmployeeAvatar";
import {
  leaveStatusLabels,
  leaveTypeLabels,
  type LeaveRequest,
  type LeaveStatus,
  type LeaveType,
} from "@/lib/leave-api";

const statusTone: Record<LeaveStatus, string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
  cancelled: "bg-slate-100 text-slate-500",
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

export function LeaveTable({
  rows,
  search,
  status,
  type,
  loading,
  busyId,
  onSearchChange,
  onStatusChange,
  onTypeChange,
  onApprove,
  onReject,
  onEdit,
  onDelete,
}: {
  rows: LeaveRequest[];
  search: string;
  status: string;
  type: string;
  loading?: boolean;
  busyId?: number | null;
  onSearchChange: (v: string) => void;
  onStatusChange: (v: string) => void;
  onTypeChange: (v: string) => void;
  onApprove: (row: LeaveRequest) => void;
  onReject: (row: LeaveRequest) => void;
  onEdit: (row: LeaveRequest) => void;
  onDelete: (row: LeaveRequest) => void;
}) {
  const tabs: { id: string; label: string }[] = [
    { id: "", label: "Tất cả" },
    { id: "pending", label: "Chờ duyệt" },
    { id: "approved", label: "Đã duyệt" },
    { id: "rejected", label: "Từ chối" },
    { id: "cancelled", label: "Đã hủy" },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-50 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id || "all"}
              type="button"
              onClick={() => onStatusChange(tab.id)}
              className={clsx(
                "rounded-lg px-3 py-1.5 text-xs font-semibold",
                status === tab.id
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={type}
            onChange={(e) => onTypeChange(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
          >
            <option value="">Mọi loại nghỉ</option>
            {(Object.keys(leaveTypeLabels) as LeaveType[]).map((k) => (
              <option key={k} value={k}>
                {leaveTypeLabels[k]}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm nhân viên, lý do..."
              className="w-56 rounded-xl border border-slate-200 py-2 pr-3 pl-9 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              <th className="px-4 py-3">Nhân viên</th>
              <th className="px-4 py-3">Loại</th>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">Lý do</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Đang tải...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  Chưa có đơn nghỉ phép.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <EmployeeAvatar
                        avatar={row.avatar}
                        name={row.full_name}
                        code={row.employee_code}
                        className="h-9 w-9 shrink-0 rounded-full"
                      />
                      <div>
                        <p className="font-semibold text-slate-800">
                          {row.full_name ?? "—"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {row.employee_code ?? "—"} · {row.position || "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {row.type_label ||
                      leaveTypeLabels[row.type as LeaveType] ||
                      row.type}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    <p>
                      {formatDate(row.from)} → {formatDate(row.to)}
                    </p>
                    <p className="text-xs text-slate-400">{row.days} ngày</p>
                  </td>
                  <td className="max-w-[220px] px-4 py-3 text-slate-600">
                    <p className="line-clamp-2">{row.reason}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{row.time}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={clsx(
                        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                        statusTone[row.status],
                      )}
                    >
                      {leaveStatusLabels[row.status]}
                    </span>
                    {row.reviewer_name ? (
                      <p className="mt-1 text-[11px] text-slate-400">
                        {row.reviewer_name}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {row.status === "pending" ? (
                        <>
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => onApprove(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <Check className="h-3.5 w-3.5" />
                            Duyệt
                          </button>
                          <button
                            type="button"
                            disabled={busyId === row.id}
                            onClick={() => onReject(row)}
                            className="inline-flex items-center gap-1 rounded-lg border border-rose-300 px-2.5 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                          >
                            <X className="h-3.5 w-3.5" />
                            Từ chối
                          </button>
                        </>
                      ) : null}
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => onEdit(row)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-500 disabled:opacity-50"
                        aria-label="Sửa"
                        title="Sửa đơn"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() => onDelete(row)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                        aria-label="Xóa"
                        title="Xóa đơn"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
