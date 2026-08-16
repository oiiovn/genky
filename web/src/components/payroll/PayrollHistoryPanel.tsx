"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import {
  formatMoney,
  type PayrollPaymentGroup,
} from "@/lib/payroll-api";
import type { Branch } from "@/lib/api";
import { EmployeeAvatar } from "@/components/ui/EmployeeAvatar";

const METHOD_LABEL: Record<string, string> = {
  cash: "Tiền mặt",
  bank: "Ngân hàng",
  transfer: "Chuyển khoản",
  other: "Khác",
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PayrollHistoryPanel({
  groups,
  total,
  page,
  lastPage,
  loading,
  yearFilter,
  monthFilter,
  search,
  branchFilter,
  branches,
  onYearChange,
  onMonthChange,
  onSearchChange,
  onBranchChange,
  onPageChange,
}: {
  groups: PayrollPaymentGroup[];
  total: number;
  page: number;
  lastPage: number;
  loading?: boolean;
  yearFilter: number | "";
  monthFilter: number | "";
  search: string;
  branchFilter: number | "";
  branches: Branch[];
  onYearChange: (v: number | "") => void;
  onMonthChange: (v: number | "") => void;
  onSearchChange: (v: string) => void;
  onBranchChange: (v: number | "") => void;
  onPageChange: (p: number) => void;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3">
        <select
          value={yearFilter === "" ? "" : String(yearFilter)}
          onChange={(e) =>
            onYearChange(e.target.value ? Number(e.target.value) : "")
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
        >
          <option value="">Tất cả năm</option>
          {years.map((y) => (
            <option key={y} value={y}>
              Năm {y}
            </option>
          ))}
        </select>
        <select
          value={monthFilter === "" ? "" : String(monthFilter)}
          onChange={(e) =>
            onMonthChange(e.target.value ? Number(e.target.value) : "")
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
        >
          <option value="">Tất cả tháng</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              Tháng {String(m).padStart(2, "0")}
            </option>
          ))}
        </select>
        <select
          value={branchFilter === "" ? "" : String(branchFilter)}
          onChange={(e) =>
            onBranchChange(e.target.value ? Number(e.target.value) : "")
          }
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
        >
          <option value="">Tất cả chi nhánh</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm nhân viên / nội dung..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {loading ? (
          <p className="px-4 py-16 text-center text-sm text-slate-400">
            Đang tải lịch sử thanh toán...
          </p>
        ) : groups.length === 0 ? (
          <p className="px-4 py-16 text-center text-sm text-slate-400">
            Chưa có giao dịch thanh toán lương.
          </p>
        ) : (
          groups.map((group) => {
            const open = openId === group.employee_id;
            return (
              <div key={group.employee_id}>
                <button
                  type="button"
                  onClick={() =>
                    setOpenId(open ? null : group.employee_id)
                  }
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  {open ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  <EmployeeAvatar
                    avatar={group.employee?.avatar}
                    name={group.employee?.full_name}
                    code={
                      group.employee?.employee_code ?? String(group.employee_id)
                    }
                    className="h-9 w-9 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-800">
                      {group.employee?.full_name ?? "—"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {group.employee?.employee_code} · {group.department} ·{" "}
                      {group.payments_count} lần
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-800">
                      {formatMoney(group.total_paid)}
                    </p>
                    <p className="text-xs text-slate-400">
                      {formatDateTime(group.last_paid_at)}
                    </p>
                  </div>
                </button>
                {open ? (
                  <div className="bg-slate-50/80 px-4 pb-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                          <th className="py-2 pr-2">Kỳ</th>
                          <th className="py-2 pr-2">Số tiền</th>
                          <th className="py-2 pr-2">Hình thức</th>
                          <th className="py-2 pr-2">Nội dung</th>
                          <th className="py-2">Thời gian</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.payments.map((p) => (
                          <tr key={p.id} className="border-t border-slate-100">
                            <td className="py-2 pr-2 text-slate-700">
                              {p.label}
                            </td>
                            <td className="py-2 pr-2 font-semibold text-slate-800">
                              {formatMoney(p.amount)}
                            </td>
                            <td className="py-2 pr-2 text-slate-600">
                              {METHOD_LABEL[p.method] ?? p.method}
                            </td>
                            <td className="py-2 pr-2 text-slate-500">
                              {p.content || "—"}
                            </td>
                            <td className="py-2 text-slate-500">
                              <p>{formatDateTime(p.paid_at)}</p>
                              {p.paid_by ? (
                                <p className="text-xs text-slate-400">
                                  bởi {p.paid_by}
                                </p>
                              ) : null}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
        <p>
          Hiển thị {groups.length} trên tổng số {total} nhân viên
        </p>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(lastPage, 6) }, (_, i) => i + 1).map(
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
        </div>
      </div>
    </div>
  );
}
