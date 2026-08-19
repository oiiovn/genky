"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleStop,
  Copy,
  Download,
  MoreHorizontal,
  Pencil,
  Plus,
  Upload,
  Users,
  UserRound,
} from "lucide-react";
import { ShiftIcon } from "@/components/shifts/ShiftIcon";
import {
  formatDuration,
  formatDurationLong,
  type Shift,
  type ShiftSummary,
} from "@/lib/shifts-api";

const tabs = [
  "Danh sách ca làm",
  "Lịch theo tuần",
  "Lịch theo tháng",
  "Phân ca tự động",
] as const;

export function MobileShifts({
  stats,
  rows,
  total,
  page,
  lastPage,
  selected,
  statusFilter,
  activeTab,
  loading,
  deactivating,
  onImport,
  onExport,
  onAdd,
  onTabChange,
  onStatusFilterChange,
  onSelect,
  onEdit,
  onDuplicate,
  onDelete,
  onDeactivate,
  onPageChange,
}: {
  stats: ShiftSummary;
  rows: Shift[];
  total: number;
  page: number;
  lastPage: number;
  selected: Shift | null;
  statusFilter: "" | "active" | "inactive";
  activeTab: (typeof tabs)[number];
  loading?: boolean;
  deactivating?: boolean;
  onImport: () => void;
  onExport: () => void;
  onAdd: () => void;
  onTabChange: (tab: (typeof tabs)[number]) => void;
  onStatusFilterChange: (v: "" | "active" | "inactive") => void;
  onSelect: (shift: Shift) => void;
  onEdit: (shift: Shift) => void;
  onDuplicate: (shift: Shift) => void;
  onDelete: (shift: Shift) => void;
  onDeactivate: (shift: Shift) => void;
  onPageChange: (p: number) => void;
}) {
  const [menuId, setMenuId] = useState<number | null>(null);

  const cards = [
    {
      label: "Tổng số ca",
      value: stats.total,
      hint: "Trong tổ chức / chi nhánh",
      icon: CalendarDays,
      tone: "bg-indigo-50 text-indigo-500",
    },
    {
      label: "Ca đang hoạt động",
      value: stats.active,
      hint: `${stats.active_percent}% tổng số ca`,
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-500",
    },
    {
      label: "Nhân viên theo ca",
      value: stats.employees_today,
      hint: `${stats.ongoing_shifts} ca đang diễn ra`,
      icon: Users,
      tone: "bg-violet-50 text-violet-500",
    },
    {
      label: "Ca trống hôm nay",
      value: stats.open_slots,
      hint: `Cần phân cho ${stats.open_slots} vị trí`,
      icon: UserRound,
      tone: "bg-amber-50 text-amber-500",
    },
  ];

  return (
    <main className="space-y-4 px-4 py-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Ca làm</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Quản lý, tạo và phân ca làm việc
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onImport}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-medium text-slate-600"
        >
          <Upload className="h-3.5 w-3.5" />
          Import ca
        </button>
        <button
          type="button"
          onClick={onExport}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 py-2 text-[11px] font-medium text-slate-600"
        >
          <Download className="h-3.5 w-3.5" />
          Xuất Excel
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex flex-1 items-center justify-center gap-1 rounded-xl bg-indigo-500 px-2 py-2 text-[11px] font-semibold text-white"
        >
          <Plus className="h-3.5 w-3.5" />
          Thêm ca mới
        </button>
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
                  <p className="mt-0.5 text-[11px] text-slate-400">{card.hint}</p>
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
        <div className="-mx-px flex gap-1 overflow-x-auto border-b border-slate-100 px-2 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange(tab)}
              className={clsx(
                "shrink-0 px-3 py-2.5 text-xs font-medium whitespace-nowrap",
                activeTab === tab
                  ? "border-b-2 border-indigo-500 text-indigo-600"
                  : "text-slate-500",
              )}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto px-3 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              ["", "Tất cả trạng thái"],
              ["active", "Đang hoạt động"],
              ["inactive", "Không hoạt động"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value || "all"}
              type="button"
              onClick={() => onStatusFilterChange(value)}
              className={clsx(
                "shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium",
                statusFilter === value
                  ? value === "active"
                    ? "bg-emerald-50 text-emerald-700"
                    : value === "inactive"
                      ? "bg-slate-200 text-slate-600"
                      : "border border-indigo-300 bg-indigo-50 text-indigo-700"
                  : "bg-slate-100 text-slate-500",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {activeTab !== "Danh sách ca làm" ? (
          <p className="px-4 py-12 text-center text-sm text-slate-400">
            Tab “{activeTab}” sẽ bổ sung khi có module phân ca.
          </p>
        ) : loading ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            Đang tải...
          </p>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            Không tìm thấy ca làm.
          </p>
        ) : (
          <ul>
            {rows.map((row) => (
              <li
                key={row.id}
                className={clsx(
                  "relative border-b border-slate-50 last:border-0",
                  selected?.id === row.id && "bg-indigo-50/40",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(row)}
                  className="flex w-full items-start gap-3 px-3 py-3 text-left"
                >
                  <div
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                    style={{
                      backgroundColor: `${row.color}22`,
                      color: row.color,
                    }}
                  >
                    {row.code?.slice(0, 2) || (
                      <ShiftIcon icon={row.icon} color={row.color} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">
                      {row.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      {row.start_time} – {row.end_time}
                      {row.crosses_midnight ? " +1" : ""} ·{" "}
                      {formatDuration(row.duration_minutes)} · nghỉ{" "}
                      {row.break_minutes}m
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: row.color }}
                        />
                        {row.color}
                      </span>
                      <span className="text-[11px] text-slate-500">
                        {row.employee_count} NV
                      </span>
                      <span
                        className={clsx(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          row.status === "active"
                            ? "bg-emerald-50 text-emerald-600"
                            : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {row.status === "active"
                          ? "Đang hoạt động"
                          : "Không hoạt động"}
                      </span>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuId(menuId === row.id ? null : row.id);
                  }}
                  className="absolute top-3 right-2 rounded-lg p-1.5 text-slate-400"
                  aria-label="Thao tác"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuId === row.id ? (
                  <div className="absolute top-10 right-2 z-20 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuId(null);
                        onEdit(row);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Sửa
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuId(null);
                        onDuplicate(row);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-slate-700"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Sao chép
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuId(null);
                        onDelete(row);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-rose-600"
                    >
                      Xóa
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2.5">
          <p className="text-[11px] text-slate-400">
            Hiển thị {rows.length} trên tổng số {total} ca làm
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
                    p === page ? "bg-indigo-500 text-white" : "text-slate-500",
                  )}
                >
                  {p}
                </button>
              ))}
          </div>
        </div>
      </section>

      {selected ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">
            Chi tiết ca làm
          </h2>
          <div className="flex items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{
                backgroundColor: `${selected.color}22`,
                color: selected.color,
              }}
            >
              {selected.code?.slice(0, 2) || (
                <ShiftIcon icon={selected.icon} color={selected.color} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-base font-bold text-slate-800">
                {selected.name}{" "}
                <span className="font-semibold text-slate-400">
                  / {selected.code}
                </span>
              </p>
              <span
                className={clsx(
                  "mt-1 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                  selected.status === "active"
                    ? "bg-emerald-50 text-emerald-600"
                    : "bg-slate-100 text-slate-500",
                )}
              >
                {selected.status === "active"
                  ? "Đang hoạt động"
                  : "Không hoạt động"}
              </span>
            </div>
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 text-xs">
            <div>
              <dt className="text-slate-400">Thời gian làm việc</dt>
              <dd className="mt-0.5 font-medium text-slate-800">
                {selected.start_time} – {selected.end_time}
                {selected.crosses_midnight ? " (+1)" : ""}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Thời lượng</dt>
              <dd className="mt-0.5 font-medium text-slate-800">
                {formatDurationLong(selected.duration_minutes)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Giờ nghỉ</dt>
              <dd className="mt-0.5 font-medium text-slate-800">
                {selected.break_minutes} phút
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Tổng thời gian</dt>
              <dd className="mt-0.5 font-medium text-slate-800">
                {formatDurationLong(selected.total_minutes)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Màu hiển thị</dt>
              <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-slate-800">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: selected.color }}
                />
                <span className="font-mono text-[11px]">{selected.color}</span>
              </dd>
            </div>
            <div>
              <dt className="text-slate-400">Mô tả</dt>
              <dd className="mt-0.5 font-medium text-slate-800">
                {selected.description || "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-4 space-y-2">
            <Link
              href={`/schedule?shift_id=${selected.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-sm text-slate-700">
                <Users className="h-4 w-4 text-indigo-500" />
                Nhân viên trong ca
              </span>
              <span className="flex items-center gap-1 text-xs text-indigo-600">
                {selected.employee_count} nhân viên
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
            <Link
              href={`/schedule?shift_id=${selected.id}`}
              className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5"
            >
              <span className="flex items-center gap-2 text-sm text-slate-700">
                <CalendarDays className="h-4 w-4 text-emerald-500" />
                Lịch phân ca
              </span>
              <span className="flex items-center gap-1 text-xs text-indigo-600">
                Xem lịch phân ca
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onEdit(selected)}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-200 py-2.5 text-sm font-semibold text-indigo-600"
            >
              <Pencil className="h-4 w-4" />
              Chỉnh sửa ca
            </button>
            {selected.status === "active" ? (
              <button
                type="button"
                disabled={deactivating}
                onClick={() => onDeactivate(selected)}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 py-2.5 text-sm font-semibold text-rose-500 disabled:opacity-60"
              >
                <CircleStop className="h-4 w-4" />
                {deactivating ? "Đang cập nhật..." : "Ngừng hoạt động"}
              </button>
            ) : (
              <span />
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
