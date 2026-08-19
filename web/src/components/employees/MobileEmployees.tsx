"use client";

import { useState } from "react";
import clsx from "clsx";
import {
  Eye,
  LayoutGrid,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  Umbrella,
  UserCheck,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { EmployeeAvatar } from "@/components/ui/EmployeeAvatar";
import {
  EmployeeFilterPanel,
  type FilterDraft,
} from "@/components/employees/EmployeeFilterPanel";
import type { Branch } from "@/lib/api";
import type { Employee, Position } from "@/lib/employees-api";

const positionTone: Record<string, string> = {
  "Quản lý": "bg-sky-50 text-sky-700",
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

export function MobileEmployees({
  stats,
  rows,
  total,
  page,
  lastPage,
  search,
  loading,
  draft,
  branches,
  positions,
  onSearchChange,
  onSearchSubmit,
  onPageChange,
  onEdit,
  onView,
  onDelete,
  onAdd,
  onDraftChange,
  onFilterApply,
  onFilterReset,
}: {
  stats: { total: number; active: number; resigned: number; leave: number };
  rows: Employee[];
  total: number;
  page: number;
  lastPage: number;
  search: string;
  loading?: boolean;
  draft: FilterDraft;
  branches: Branch[];
  positions: Position[];
  onSearchChange: (v: string) => void;
  onSearchSubmit: () => void;
  onPageChange: (p: number) => void;
  onEdit: (employee: Employee) => void;
  onView: (employee: Employee) => void;
  onDelete: (employee: Employee) => void;
  onAdd: () => void;
  onDraftChange: (next: FilterDraft) => void;
  onFilterApply: () => void;
  onFilterReset: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);

  const activePct =
    stats.total > 0 ? ((stats.active / stats.total) * 100).toFixed(1) : "0.0";
  const resignedPct =
    stats.total > 0 ? ((stats.resigned / stats.total) * 100).toFixed(1) : "0.0";
  const leavePct =
    stats.total > 0 ? ((stats.leave / stats.total) * 100).toFixed(1) : "0.0";

  const cards = [
    {
      label: "Tổng nhân viên",
      value: String(stats.total),
      hint: null as string | null,
      icon: Users,
      tone: "bg-indigo-50 text-indigo-500",
    },
    {
      label: "Đang làm việc",
      value: String(stats.active),
      hint: `${activePct}% tổng số`,
      icon: UserCheck,
      tone: "bg-emerald-50 text-emerald-500",
    },
    {
      label: "Nghỉ việc",
      value: String(stats.resigned),
      hint: `${resignedPct}% tổng số`,
      icon: UserMinus,
      tone: "bg-rose-50 text-rose-500",
    },
    {
      label: "Nghỉ phép",
      value: String(stats.leave),
      hint: `${leavePct}% tổng số`,
      icon: Umbrella,
      tone: "bg-amber-50 text-amber-500",
    },
  ];

  function toggle(id: number) {
    setSelected((curr) =>
      curr.includes(id) ? curr.filter((x) => x !== id) : [...curr, id],
    );
  }

  return (
    <main className="space-y-4 px-4 py-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Nhân viên</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Quản lý hồ sơ, chức vụ và chi nhánh nhân sự
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-slate-500">{card.label}</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {card.value}
                  </p>
                  {card.hint ? (
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {card.hint}
                    </p>
                  ) : null}
                </div>
                <div
                  className={clsx(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                    card.tone,
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-3">
          <h2 className="text-sm font-semibold text-slate-800">
            Danh sách nhân viên ({total})
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              className={clsx(
                "rounded-full border p-2",
                searchOpen
                  ? "border-indigo-200 bg-indigo-50 text-indigo-600"
                  : "border-slate-200 text-slate-400",
              )}
              aria-label="Tìm kiếm"
            >
              <Search className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="rounded-full border border-slate-200 p-2 text-slate-400"
              aria-label="Lưới"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="rounded-full border border-slate-200 p-2 text-slate-400"
              aria-label="Bộ lọc"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>

        {searchOpen ? (
          <div className="border-b border-slate-100 px-3 py-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onSearchSubmit()}
                placeholder="Tìm kiếm nhân viên..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pr-3 pl-9 text-sm outline-none focus:border-indigo-400 focus:bg-white"
              />
            </div>
          </div>
        ) : null}

        {loading ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            Đang tải...
          </p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            Chưa có nhân viên. Bấm + để thêm mới.
          </p>
        ) : (
          <ul>
            {rows.map((row) => {
              const primary =
                row.branches.find((b) => b.is_primary) ?? row.branches[0];
              const posName = row.position?.name ?? "—";
              const checked = selected.includes(row.id);
              return (
                <li
                  key={row.id}
                  className="flex items-start gap-2 border-b border-slate-50 px-3 py-3 last:border-0"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(row.id)}
                    className="mt-3 rounded border-slate-300"
                  />
                  <EmployeeAvatar
                    avatar={row.avatar}
                    name={row.full_name}
                    code={row.employee_code}
                    className="mt-0.5 h-10 w-10 rounded-full"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {row.full_name}{" "}
                      <span className="font-medium text-slate-400">
                        · {row.employee_code}
                      </span>
                    </p>
                    <p
                      className={clsx(
                        "mt-0.5 text-[11px] font-medium",
                        row.has_user_account
                          ? "text-emerald-600"
                          : "text-amber-600",
                      )}
                    >
                      {row.has_user_account
                        ? "Đã có tài khoản"
                        : "Chưa có tài khoản"}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={clsx(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          positionTone[posName] ?? "bg-slate-100 text-slate-600",
                        )}
                      >
                        {posName}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {primary?.name ?? "—"}
                      </span>
                      <span
                        className={clsx(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          statusTone[row.status] ?? "bg-slate-100 text-slate-600",
                        )}
                      >
                        {statusLabel[row.status] ?? row.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-0.5">
                    <button
                      type="button"
                      onClick={() => onView(row)}
                      className="rounded-lg p-1.5 text-slate-400"
                      aria-label="Xem"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(row)}
                      className="rounded-lg p-1.5 text-slate-400"
                      aria-label="Sửa"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(row)}
                      className="rounded-lg p-1.5 text-slate-400"
                      aria-label="Xóa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2.5">
          <p className="text-[11px] text-slate-400">
            Hiển thị {rows.length}/{total}
          </p>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.max(lastPage, 1) }, (_, i) => i + 1)
              .slice(0, 5)
              .map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onPageChange(p)}
                  className={clsx(
                    "h-8 min-w-8 rounded-lg px-2 text-sm font-medium",
                    p === page
                      ? "bg-indigo-500 text-white"
                      : "text-slate-500",
                  )}
                >
                  {p}
                </button>
              ))}
          </div>
        </div>
      </section>

      <div className="relative overflow-hidden rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-sky-50 px-4 py-4 pr-16">
        <p className="text-sm font-semibold text-slate-800">
          Quản lý nhân viên hiệu quả
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Thêm nhân viên, gán chi nhánh và chức vụ ngay trên Genky
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="absolute top-1/2 right-4 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-indigo-500 text-white shadow-lg shadow-indigo-200"
          aria-label="Thêm nhân viên"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

      {filterOpen ? (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Đóng bộ lọc"
            onClick={() => setFilterOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="flex items-center justify-between px-4 pt-3">
              <span className="text-sm font-semibold text-slate-800">
                Bộ lọc
              </span>
              <button
                type="button"
                onClick={() => setFilterOpen(false)}
                className="p-1 text-slate-400"
                aria-label="Đóng"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4">
              <EmployeeFilterPanel
                draft={draft}
                branches={branches}
                positions={positions}
                onChange={onDraftChange}
                onApply={() => {
                  onFilterApply();
                  setFilterOpen(false);
                }}
                onReset={() => {
                  onFilterReset();
                  setFilterOpen(false);
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
