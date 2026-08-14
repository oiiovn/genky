"use client";

import clsx from "clsx";
import { Eye, MoreHorizontal, Pencil, Search, SlidersHorizontal } from "lucide-react";
import {
  formatDate,
  formatMoney,
  type AdjustmentRecord,
  type AdjustmentType,
} from "@/lib/adjustments";

export type AdjustmentTab =
  | "overview"
  | "rewards"
  | "penalties"
  | "reasons"
  | "reports";

export function AdjustmentRecentTables({
  rewards,
  penalties,
  rewardTotal,
  penaltyTotal,
  rewardPage,
  penaltyPage,
  lastRewardPage,
  lastPenaltyPage,
  onRewardPage,
  onPenaltyPage,
  onEdit,
}: {
  rewards: AdjustmentRecord[];
  penalties: AdjustmentRecord[];
  rewardTotal: number;
  penaltyTotal: number;
  rewardPage: number;
  penaltyPage: number;
  lastRewardPage: number;
  lastPenaltyPage: number;
  onRewardPage: (p: number) => void;
  onPenaltyPage: (p: number) => void;
  onEdit: (row: AdjustmentRecord) => void;
}) {
  return (
    <div className="space-y-5">
      <RecordTable
        title="Thưởng gần đây"
        rows={rewards}
        total={rewardTotal}
        page={rewardPage}
        lastPage={lastRewardPage}
        tone="reward"
        onPage={onRewardPage}
        onEdit={onEdit}
      />
      <RecordTable
        title="Phạt gần đây"
        rows={penalties}
        total={penaltyTotal}
        page={penaltyPage}
        lastPage={lastPenaltyPage}
        tone="penalty"
        onPage={onPenaltyPage}
        onEdit={onEdit}
      />
    </div>
  );
}

function RecordTable({
  title,
  rows,
  total,
  page,
  lastPage,
  tone,
  onPage,
  onEdit,
}: {
  title: string;
  rows: AdjustmentRecord[];
  total: number;
  page: number;
  lastPage: number;
  tone: AdjustmentType;
  onPage: (p: number) => void;
  onEdit: (row: AdjustmentRecord) => void;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <h3 className="font-semibold text-slate-800">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[900px] w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              <th className="px-3 py-3">STT</th>
              <th className="px-3 py-3">Nhân viên</th>
              <th className="px-3 py-3">Phòng ban</th>
              <th className="px-3 py-3">Lý do</th>
              <th className="px-3 py-3 text-right">Số tiền</th>
              <th className="px-3 py-3">Ngày</th>
              <th className="px-3 py-3">Người tạo</th>
              <th className="px-3 py-3 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                  Chưa có bản ghi.
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-3 text-slate-500">
                    {(page - 1) * 5 + index + 1}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2.5">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={
                          row.avatar ||
                          `https://i.pravatar.cc/80?u=${encodeURIComponent(row.employee_code)}`
                        }
                        alt=""
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">
                          {row.full_name}
                        </p>
                        <p className="text-xs text-slate-400">{row.employee_code}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-slate-600">{row.department}</td>
                  <td className="max-w-[200px] truncate px-3 py-3 text-slate-600">
                    {row.reason}
                  </td>
                  <td
                    className={clsx(
                      "px-3 py-3 text-right font-semibold",
                      tone === "reward" ? "text-emerald-600" : "text-rose-600",
                    )}
                  >
                    {formatMoney(row.amount)}
                  </td>
                  <td className="px-3 py-3 text-slate-600">
                    {formatDate(row.date)}
                  </td>
                  <td className="px-3 py-3 text-slate-500">{row.created_by}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                        aria-label="Xem"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onEdit(row)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                        aria-label="Sửa"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
                        aria-label="Thêm"
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-sm text-slate-500">
        <p>
          Hiển thị {rows.length} trên tổng số {total} bản ghi
        </p>
        <div className="flex gap-1">
          {Array.from({ length: Math.min(lastPage, 5) }, (_, i) => i + 1).map(
            (p) => (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
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
    </section>
  );
}

export function AdjustmentFilters({
  tab,
  rangeLabel,
  branchFilter,
  departmentFilter,
  typeFilter,
  search,
  branches,
  departments,
  onTabChange,
  onBranchChange,
  onDepartmentChange,
  onTypeChange,
  onSearchChange,
}: {
  tab: AdjustmentTab;
  rangeLabel: string;
  branchFilter: number | "";
  departmentFilter: string;
  typeFilter: "" | AdjustmentType;
  search: string;
  branches: { id: number; name: string }[];
  departments: string[];
  onTabChange: (t: AdjustmentTab) => void;
  onBranchChange: (v: number | "") => void;
  onDepartmentChange: (v: string) => void;
  onTypeChange: (v: "" | AdjustmentType) => void;
  onSearchChange: (v: string) => void;
}) {
  const tabs: { id: AdjustmentTab; label: string }[] = [
    { id: "overview", label: "Tổng quan" },
    { id: "rewards", label: "Danh sách thưởng" },
    { id: "penalties", label: "Danh sách phạt" },
    { id: "reasons", label: "Cấu hình lý do" },
    { id: "reports", label: "Báo cáo" },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            className={clsx(
              "rounded-xl px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition",
              tab === t.id
                ? "bg-indigo-500 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === "overview" || tab === "rewards" || tab === "penalties") && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">
            {rangeLabel}
          </span>
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
            value={typeFilter}
            onChange={(e) =>
              onTypeChange(e.target.value as "" | AdjustmentType)
            }
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 outline-none focus:border-indigo-400"
          >
            <option value="">Loại</option>
            <option value="reward">Thưởng</option>
            <option value="penalty">Phạt</option>
          </select>
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Tìm kiếm nhân viên, lý do..."
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
      )}
    </div>
  );
}
