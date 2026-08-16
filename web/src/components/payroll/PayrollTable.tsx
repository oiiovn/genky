"use client";

import clsx from "clsx";
import {
  CheckCircle2,
  Clock3,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import {
  formatHours,
  formatMoney,
  type PayrollRow,
  type PayrollStatus,
} from "@/lib/payroll";
import type { Branch } from "@/lib/api";
import { type PayrollPaymentGroup } from "@/lib/payroll-api";
import { PayrollHistoryPanel } from "@/components/payroll/PayrollHistoryPanel";
import { EmployeeAvatar } from "@/components/ui/EmployeeAvatar";

export type PayrollMainTab =
  | "sheet"
  | "history"
  | "config"
  | "allowance"
  | "tax";

export function PayrollTable({
  rows,
  total,
  page,
  lastPage,
  perPage,
  selectedIds,
  loading,
  mainTab,
  search,
  branchFilter,
  departmentFilter,
  statusFilter,
  monthLabel,
  branches,
  departments,
  paymentGroups,
  historyTotal,
  historyPage,
  historyLastPage,
  historyLoading,
  historyYearFilter,
  historyMonthFilter,
  historySearch,
  onMainTabChange,
  onSearchChange,
  onBranchChange,
  onDepartmentChange,
  onStatusChange,
  onToggleRow,
  onToggleAll,
  onPageChange,
  onPerPageChange,
  onPayRow,
  onHistoryYearChange,
  onHistoryMonthChange,
  onHistorySearchChange,
  onHistoryPageChange,
}: {
  rows: PayrollRow[];
  total: number;
  page: number;
  lastPage: number;
  perPage: number;
  selectedIds: number[];
  loading?: boolean;
  mainTab: PayrollMainTab;
  search: string;
  branchFilter: number | "";
  departmentFilter: string;
  statusFilter: "" | PayrollStatus;
  monthLabel: string;
  branches: Branch[];
  departments: string[];
  paymentGroups: PayrollPaymentGroup[];
  historyTotal: number;
  historyPage: number;
  historyLastPage: number;
  historyLoading?: boolean;
  historyYearFilter: number | "";
  historyMonthFilter: number | "";
  historySearch: string;
  onMainTabChange: (t: PayrollMainTab) => void;
  onSearchChange: (v: string) => void;
  onBranchChange: (v: number | "") => void;
  onDepartmentChange: (v: string) => void;
  onStatusChange: (v: "" | PayrollStatus) => void;
  onToggleRow: (id: number) => void;
  onToggleAll: () => void;
  onPageChange: (p: number) => void;
  onPerPageChange: (n: number) => void;
  onPayRow: (id: number) => void;
  onHistoryYearChange: (v: number | "") => void;
  onHistoryMonthChange: (v: number | "") => void;
  onHistorySearchChange: (v: string) => void;
  onHistoryPageChange: (p: number) => void;
}) {
  const tabs: { id: PayrollMainTab; label: string }[] = [
    { id: "sheet", label: "Bảng lương" },
    { id: "history", label: "Lịch sử trả lương" },
    { id: "config", label: "Cấu hình lương" },
    { id: "allowance", label: "Phụ cấp / Thưởng" },
    { id: "tax", label: "Thuế / BHXH" },
  ];

  const allSelected =
    rows.length > 0 && rows.every((r) => selectedIds.includes(r.id));

  const totals = rows.reduce(
    (acc, r) => {
      acc.leave += r.leave_days ?? 0;
      acc.minutes += r.total_minutes;
      acc.income += r.income;
      acc.deductions += r.deductions;
      acc.net += r.net;
      acc.paid += r.paid_amount ?? 0;
      acc.remaining += r.remaining ?? Math.max(0, r.net - (r.paid_amount ?? 0));
      return acc;
    },
    { minutes: 0, leave: 0, income: 0, deductions: 0, net: 0, paid: 0, remaining: 0 },
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-3 border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onMainTabChange(t.id)}
              className={clsx(
                "rounded-xl px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition",
                mainTab === t.id
                  ? "bg-indigo-500 text-white shadow-sm"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {mainTab === "sheet" ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
              {monthLabel}
            </span>
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
            <select
              value={departmentFilter}
              onChange={(e) => onDepartmentChange(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
            >
              <option value="">Tất cả phòng ban</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) =>
                onStatusChange(e.target.value as "" | PayrollStatus)
              }
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
            >
              <option value="">Trạng thái</option>
              <option value="paid">Đã thanh toán</option>
              <option value="partial">Trả một phần</option>
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
        ) : null}
      </div>

      {mainTab === "history" ? (
        <PayrollHistoryPanel
          groups={paymentGroups}
          total={historyTotal}
          page={historyPage}
          lastPage={historyLastPage}
          loading={historyLoading}
          yearFilter={historyYearFilter}
          monthFilter={historyMonthFilter}
          search={historySearch}
          branchFilter={branchFilter}
          branches={branches}
          onYearChange={onHistoryYearChange}
          onMonthChange={onHistoryMonthChange}
          onSearchChange={onHistorySearchChange}
          onBranchChange={onBranchChange}
          onPageChange={onHistoryPageChange}
        />
      ) : mainTab !== "sheet" ? (
        <div className="px-6 py-16 text-center">
          <p className="text-sm font-medium text-slate-700">
            Tab này đang được hoàn thiện
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Hiện dùng <strong>Bảng lương</strong> và{" "}
            <strong>Lịch sử trả lương</strong>.
          </p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-[1080px] w-full border-collapse text-sm">
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
                  <th className="px-3 py-3">Chức vụ</th>
                  <th className="px-3 py-3 text-right">Tổng giờ</th>
                  <th className="px-3 py-3 text-right">Ngày nghỉ</th>
                  <th className="px-3 py-3 text-right">Tổng thu nhập</th>
                  <th className="px-3 py-3 text-right">Khấu trừ</th>
                  <th className="px-3 py-3 text-right">Thực nhận</th>
                  <th className="px-3 py-3 text-right">Đã trả</th>
                  <th className="px-3 py-3 text-right">Còn lại</th>
                  <th className="px-3 py-3">Trạng thái</th>
                  <th className="px-3 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={14}
                      className="px-4 py-16 text-center text-slate-400"
                    >
                      Đang tải bảng lương...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={14}
                      className="px-4 py-16 text-center text-slate-400"
                    >
                      Chưa có dữ liệu lương tháng này.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
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
                      <td className="px-3 py-3 text-slate-600">
                        {row.position}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700">
                        {formatHours(row.total_minutes)}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700">
                        {row.leave_days ?? 0}
                        {(row.unpaid_days ?? 0) > 0 ? (
                          <span className="ml-1 text-xs font-medium text-rose-500">
                            ({row.unpaid_days} KL)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-700">
                        {formatMoney(row.income)}
                      </td>
                      <td className="px-3 py-3 text-right text-rose-500">
                        {row.deductions > 0 ? `-${formatMoney(row.deductions)}` : "—"}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-slate-800">
                        {formatMoney(row.net)}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600">
                        {formatMoney(row.paid_amount ?? 0)}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-amber-600">
                        {formatMoney(row.remaining ?? Math.max(0, row.net - (row.paid_amount ?? 0)))}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                            row.status === "paid"
                              ? "bg-emerald-50 text-emerald-600"
                              : row.status === "partial"
                                ? "bg-sky-50 text-sky-600"
                                : "bg-amber-50 text-amber-600",
                          )}
                        >
                          {row.status === "paid" ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            <Clock3 className="h-3.5 w-3.5" />
                          )}
                          {row.status === "paid"
                            ? "Đã thanh toán"
                            : row.status === "partial"
                              ? "Trả một phần"
                              : "Chờ duyệt"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="inline-flex items-center gap-1">
                          {(row.remaining ?? row.net - (row.paid_amount ?? 0)) > 0 ? (
                            <button
                              type="button"
                              onClick={() => onPayRow(row.id)}
                              className="rounded-lg px-2 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-50"
                            >
                              Thanh toán
                            </button>
                          ) : null}
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
              {rows.length > 0 ? (
                <tfoot>
                  <tr className="border-t border-slate-200 bg-slate-50 text-sm font-semibold text-slate-800">
                    <td colSpan={5} className="px-3 py-3">
                      Tổng cộng (trang này)
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatHours(totals.minutes)}
                    </td>
                    <td className="px-3 py-3 text-right">{totals.leave}</td>
                    <td className="px-3 py-3 text-right">
                      {formatMoney(totals.income)}
                    </td>
                    <td className="px-3 py-3 text-right text-rose-500">
                      {totals.deductions > 0
                        ? `-${formatMoney(totals.deductions)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatMoney(totals.net)}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {formatMoney(totals.paid)}
                    </td>
                    <td className="px-3 py-3 text-right text-amber-600">
                      {formatMoney(totals.remaining)}
                    </td>
                    <td colSpan={2} />
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
                {Array.from(
                  { length: Math.min(lastPage, 5) },
                  (_, i) => i + 1,
                ).map((p) => (
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
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
