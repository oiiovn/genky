"use client";

import Link from "next/link";
import clsx from "clsx";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  Download,
  Fingerprint,
  QrCode,
  UserCheck,
  Users,
} from "lucide-react";
import type { Branch } from "@/lib/api";
import type {
  AttendanceRow,
  AttendanceStats,
  AttendanceUiStatus,
  ShiftTodayCard,
} from "@/lib/attendance-api";
import {
  formatDailyWage,
  statusLabel,
  statusTone,
} from "@/lib/attendance-api";
import { AttendanceRowActions } from "@/components/attendance/AttendanceRowActions";
import { EmployeeAvatar } from "@/components/ui/EmployeeAvatar";
import type { Shift } from "@/lib/shifts-api";

const SELECT_BG =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'><polyline points='6 9 12 15 18 9'/></svg>\")";

const LEGEND: { label: string; color: string }[] = [
  { label: "Đã check-out", color: "#94A3B8" },
  { label: "Đang làm việc", color: "#22C55E" },
  { label: "Chưa check-in", color: "#F97316" },
  { label: "Nghỉ phép", color: "#8B5CF6" },
  { label: "Vắng mặt", color: "#EF4444" },
];

function EmptyClipboardArt() {
  return (
    <svg
      viewBox="0 0 140 110"
      className="mx-auto h-[92px] w-[120px]"
      aria-hidden
    >
      <rect x="34" y="18" width="72" height="80" rx="10" fill="#E8F1FF" />
      <rect x="48" y="10" width="44" height="18" rx="6" fill="#BFDBFE" />
      <rect x="46" y="38" width="48" height="6" rx="3" fill="#93C5FD" />
      <rect x="46" y="50" width="36" height="6" rx="3" fill="#BFDBFE" />
      <rect x="46" y="62" width="42" height="6" rx="3" fill="#BFDBFE" />
      <circle cx="96" cy="78" r="22" fill="#DBEAFE" />
      <circle cx="96" cy="78" r="14" fill="#FFFFFF" />
      <circle cx="96" cy="78" r="2.5" fill="#2B63E1" />
      <path
        d="M96 78 V68"
        stroke="#2B63E1"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M96 78 L103 82"
        stroke="#60A5FA"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function shiftAccent(shift: ShiftTodayCard, catalog: Shift[]): string {
  const fromCatalog = catalog.find((s) => s.id === shift.id)?.color;
  if (fromCatalog) return fromCatalog;
  const name = shift.name.toLowerCase();
  if (name.includes("sáng")) return "#2B63E1";
  if (name.includes("chiều")) return "#F97316";
  if (name.includes("tối")) return "#8B5CF6";
  if (name.includes("đêm")) return "#64748B";
  return "#2B63E1";
}

function statusBadge(status: ShiftTodayCard["status"]) {
  if (status === "ongoing") {
    return {
      label: "Đang diễn ra",
      className: "bg-emerald-50 text-emerald-600",
    };
  }
  if (status === "upcoming") {
    return { label: "Sắp tới", className: "bg-sky-50 text-sky-600" };
  }
  return { label: "Đã kết thúc", className: "bg-slate-100 text-slate-500" };
}

export function MobileAttendance({
  stats,
  shiftsToday,
  shifts,
  rows,
  total,
  page,
  lastPage,
  loading,
  branches,
  branchFilter,
  shiftFilter,
  statusFilter,
  onBranchChange,
  onShiftChange,
  onStatusChange,
  onPageChange,
  onExport,
  onCheckIn,
  checkInLoading,
  onView,
  onEdit,
  onDelete,
}: {
  stats: AttendanceStats;
  shiftsToday: ShiftTodayCard[];
  shifts: Shift[];
  rows: AttendanceRow[];
  total: number;
  page: number;
  lastPage: number;
  loading?: boolean;
  branches: Branch[];
  branchFilter: number | "";
  shiftFilter: number | "";
  statusFilter: "" | AttendanceUiStatus;
  onBranchChange: (v: number | "") => void;
  onShiftChange: (v: number | "") => void;
  onStatusChange: (v: "" | AttendanceUiStatus) => void;
  onPageChange: (p: number) => void;
  onExport: () => void;
  onCheckIn: () => void;
  checkInLoading?: boolean;
  onView: (row: AttendanceRow) => void;
  onEdit: (row: AttendanceRow) => void;
  onDelete: (row: AttendanceRow) => void;
}) {
  const pct = (n: number) =>
    stats.total > 0 ? `${Math.round((n / stats.total) * 100)}%` : "0%";

  const cards = [
    {
      label: "Tổng nhân viên",
      value: stats.total,
      hint: "100%",
      icon: Users,
      tone: "bg-[#E8F0FE] text-[#2B63E1]",
    },
    {
      label: "Đã check-in",
      value: stats.checked_in,
      hint: pct(stats.checked_in),
      icon: CheckCircle2,
      tone: "bg-emerald-50 text-emerald-500",
    },
    {
      label: "Đang làm việc",
      value: stats.working,
      hint: pct(stats.working),
      icon: UserCheck,
      tone: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Chưa check-in",
      value: stats.not_checked_in,
      hint: pct(stats.not_checked_in),
      icon: Building2,
      tone: "bg-rose-50 text-rose-500",
    },
  ];

  const empty = !loading && rows.length === 0;

  return (
    <main className="space-y-3.5 px-3.5 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-[22px] leading-tight font-bold text-slate-900">
            Chấm công
          </h1>
          <p className="mt-1 text-[12px] leading-snug text-slate-400">
            Theo dõi check-in / check-out theo ca và chi nhánh
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            type="button"
            onClick={onExport}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-600"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            Xuất Excel
          </button>
          <button
            type="button"
            onClick={onCheckIn}
            disabled={checkInLoading}
            className="inline-flex items-center gap-1 rounded-lg bg-[#2B63E1] px-2 py-1.5 text-[11px] font-semibold text-white shadow-sm disabled:opacity-60"
          >
            <Fingerprint className="h-3.5 w-3.5" />
            {checkInLoading ? "Đang tải..." : "Check-in / Check-out"}
          </button>
          <Link
            href="/attendance/qr"
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-600"
          >
            <QrCode className="h-3.5 w-3.5 text-slate-400" />
            QR chấm công
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <article
              key={card.label}
              className="rounded-xl border border-slate-100 bg-white p-2 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div
                className={clsx(
                  "mb-1.5 flex h-7 w-7 items-center justify-center rounded-full",
                  card.tone,
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <p className="text-[9px] leading-tight text-slate-400">
                {card.label}
              </p>
              <p className="mt-0.5 text-lg leading-none font-bold text-slate-800">
                {card.value}
              </p>
              <p className="mt-1 text-[10px] font-medium text-slate-400">
                {card.hint}
              </p>
            </article>
          );
        })}
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <select
          value={branchFilter === "" ? "" : String(branchFilter)}
          onChange={(e) =>
            onBranchChange(e.target.value ? Number(e.target.value) : "")
          }
          className="h-9 w-full appearance-none truncate rounded-lg border border-slate-200 bg-white bg-[length:10px] bg-[right_8px_center] bg-no-repeat px-2 pr-6 text-[10px] text-slate-600"
          style={{ backgroundImage: SELECT_BG }}
        >
          <option value="">Tất cả chi nhánh</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          value={shiftFilter === "" ? "" : String(shiftFilter)}
          onChange={(e) =>
            onShiftChange(e.target.value ? Number(e.target.value) : "")
          }
          className="h-9 w-full appearance-none truncate rounded-lg border border-slate-200 bg-white bg-[length:10px] bg-[right_8px_center] bg-no-repeat px-2 pr-6 text-[10px] text-slate-600"
          style={{ backgroundImage: SELECT_BG }}
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
          className="h-9 w-full appearance-none truncate rounded-lg border border-slate-200 bg-white bg-[length:10px] bg-[right_8px_center] bg-no-repeat px-2 pr-6 text-[10px] text-slate-600"
          style={{ backgroundImage: SELECT_BG }}
        >
          <option value="">Tất cả trạng thái</option>
          <option value="checked_out">Đã check-out</option>
          <option value="working">Đang làm việc</option>
          <option value="not_checked_in">Chưa check-in</option>
          <option value="on_leave">Nghỉ phép</option>
          <option value="absent">Vắng mặt</option>
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {LEGEND.map((item) => (
          <span
            key={item.label}
            className="inline-flex items-center gap-1.5 text-[10px] text-slate-500"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.label}
          </span>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className={clsx("overflow-x-auto", empty && "overflow-x-hidden")}>
          <table
            className={clsx(
              "w-full border-collapse text-left",
              empty ? "table-fixed" : "min-w-[980px]",
            )}
          >
            <thead>
              <tr className="border-b border-slate-100">
                {[
                  "Nhân viên",
                  "Ngày",
                  "Ca làm",
                  "Check-in",
                  "Check-out",
                  "Tổng phút",
                  "Tiền công",
                  "Trạng thái",
                  "Chi nhánh",
                  "Thao tác",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-2 py-2.5 text-[10px] font-semibold whitespace-nowrap text-slate-500"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-12 text-center text-sm text-slate-400"
                  >
                    Đang tải...
                  </td>
                </tr>
              ) : empty ? (
                <tr>
                  <td colSpan={10} className="px-3 py-10 text-center">
                    <EmptyClipboardArt />
                    <p className="mt-2 text-[12px] text-slate-400">
                      Không có dữ liệu chấm công.
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.id ?? `${row.employee_id}-${row.work_date}`}
                    className="border-t border-slate-50"
                  >
                    <td className="px-2 py-2">
                      <div className="flex min-w-[128px] items-center gap-1.5">
                        <EmployeeAvatar
                          avatar={row.avatar}
                          name={row.full_name}
                          code={row.employee_code}
                          className="h-7 w-7 rounded-full"
                        />
                        <p className="truncate text-[11px] font-semibold text-slate-800">
                          {row.full_name}
                        </p>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-[11px] whitespace-nowrap text-slate-600">
                      {row.work_date
                        ? row.work_date.split("-").reverse().join("/")
                        : "—"}
                    </td>
                    <td className="px-2 py-2 text-[11px] whitespace-nowrap text-slate-700">
                      {row.shift_name || "—"}
                    </td>
                    <td className="px-2 py-2 text-[11px] whitespace-nowrap text-slate-700">
                      {row.check_in ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-[11px] whitespace-nowrap text-slate-700">
                      {row.check_out ?? "—"}
                    </td>
                    <td className="px-2 py-2 text-[11px] text-slate-700">
                      {row.total_minutes != null ? row.total_minutes : "—"}
                    </td>
                    <td className="px-2 py-2 text-[11px] font-semibold whitespace-nowrap text-slate-800">
                      {formatDailyWage(row.daily_wage)}
                    </td>
                    <td className="px-2 py-2">
                      <span
                        className={clsx(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          statusTone[row.ui_status],
                        )}
                      >
                        {row.ui_status === "on_leave" && row.leave_type_label
                          ? row.leave_type_label
                          : statusLabel[row.ui_status]}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-[11px] whitespace-nowrap text-slate-600">
                      {row.branch_name ?? "—"}
                    </td>
                    <td className="px-2 py-2">
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
        <div className="flex items-center justify-between border-t border-slate-100 px-3 py-2.5">
          <p className="text-[11px] text-slate-400">
            Hiển thị {rows.length} trên tổng số {total} bản ghi
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
                    "h-7 min-w-7 rounded-md px-2 text-[11px] font-semibold",
                    p === page
                      ? "bg-[#2B63E1] text-white"
                      : "text-slate-400",
                  )}
                >
                  {p}
                </button>
              ))}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-[13px] font-bold text-slate-800">
          Tổng quan hôm nay
        </h2>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-100 bg-white px-2.5 py-1.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <Users className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-[12px] font-semibold text-slate-700">
            {stats.total} Nhân viên
          </span>
        </div>
      </section>

      <section>
        <h2 className="mb-2 text-[13px] font-bold text-slate-800">
          Ca làm hôm nay
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {shiftsToday.map((shift) => {
            const accent = shiftAccent(shift, shifts);
            const badge = statusBadge(shift.status);
            const percent =
              shift.total > 0
                ? Math.round((shift.checked / shift.total) * 100)
                : 0;
            return (
              <article
                key={shift.id}
                className="overflow-hidden rounded-xl border border-slate-100 bg-white p-2.5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-[12px] font-bold text-slate-800">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: accent }}
                      />
                      <span className="truncate">{shift.name}</span>
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {shift.time}
                    </p>
                  </div>
                  <span
                    className={clsx(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
                      badge.className,
                    )}
                  >
                    {badge.label}
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                  <span>
                    {shift.checked}/{shift.total} đã check-in
                  </span>
                  <span>{percent}%</span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 text-center">
                  <div>
                    <p className="text-[9px] text-slate-400">Đúng giờ</p>
                    <p className="text-[12px] font-bold text-slate-800">
                      {shift.ontime}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400">Đi trễ</p>
                    <p className="text-[12px] font-bold text-slate-800">
                      {shift.late}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400">Chưa vào</p>
                    <p className="text-[12px] font-bold text-slate-800">
                      {shift.missing}
                    </p>
                  </div>
                </div>
                <div
                  className="mt-2 h-[3px] rounded-full"
                  style={{ backgroundColor: accent }}
                />
              </article>
            );
          })}
        </div>
        <Link
          href="/schedule"
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-100 bg-white py-2.5 text-[12px] font-semibold text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
        >
          <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
          Xem lịch làm việc →
        </Link>
      </section>
    </main>
  );
}
