"use client";

import {
  CalendarDays,
  ChevronRight,
  CircleStop,
  Users,
  X,
} from "lucide-react";
import type { Shift } from "@/lib/shifts-api";
import { formatDurationLong } from "@/lib/shifts-api";
import { ShiftIcon } from "@/components/shifts/ShiftIcon";

export function ShiftDetailPanel({
  shift,
  onClose,
  onEdit,
  onDeactivate,
  deactivating,
}: {
  shift: Shift | null;
  onClose: () => void;
  onEdit: (shift: Shift) => void;
  onDeactivate: (shift: Shift) => void;
  deactivating?: boolean;
}) {
  if (!shift) {
    return (
      <aside className="hidden w-[320px] shrink-0 rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-sm text-slate-400 xl:block">
        Chọn một ca làm để xem chi tiết.
      </aside>
    );
  }

  const rows = [
    {
      label: "Thời gian làm việc",
      value: `${shift.start_time} - ${shift.end_time}${
        shift.crosses_midnight ? " (+1)" : ""
      }`,
    },
    {
      label: "Thời lượng",
      value: formatDurationLong(shift.duration_minutes),
    },
    {
      label: "Giờ nghỉ",
      value: `${shift.break_minutes} phút`,
    },
    {
      label: "Tổng thời gian",
      value: formatDurationLong(shift.total_minutes),
    },
  ];

  return (
    <aside className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white shadow-sm xl:w-[320px]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h3 className="font-semibold text-slate-800">Chi tiết ca làm</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          aria-label="Đóng"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-5 py-5">
        <div className="flex items-start gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${shift.color}22` }}
          >
            <ShiftIcon
              icon={shift.icon}
              color={shift.color}
              className="h-6 w-6"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-bold text-slate-800">
              {shift.name}{" "}
              <span className="font-semibold text-slate-400">
                / {shift.code}
              </span>
            </p>
            <span
              className={
                shift.status === "active"
                  ? "mt-1 inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-600"
                  : "mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-500"
              }
            >
              {shift.status === "active"
                ? "Đang hoạt động"
                : "Không hoạt động"}
            </span>
          </div>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex justify-between gap-3">
              <dt className="text-slate-500">{row.label}</dt>
              <dd className="text-right font-medium text-slate-800">
                {row.value}
              </dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-500">Màu hiển thị</dt>
            <dd className="flex items-center gap-2 font-medium text-slate-800">
              <span
                className="h-3.5 w-3.5 rounded-full"
                style={{ backgroundColor: shift.color }}
              />
              <span className="font-mono text-xs">{shift.color}</span>
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Mô tả</dt>
            <dd className="mt-1 text-slate-700">
              {shift.description || "—"}
            </dd>
          </div>
        </dl>

        <div className="mt-5 space-y-2">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 text-sm hover:bg-slate-50"
          >
            <span className="flex items-center gap-2 text-slate-700">
              <Users className="h-4 w-4 text-slate-400" />
              Nhân viên trong ca
            </span>
            <span className="flex items-center gap-1 text-indigo-600">
              {shift.employee_count} nhân viên
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-xl border border-slate-100 px-3 py-2.5 text-sm hover:bg-slate-50"
          >
            <span className="flex items-center gap-2 text-slate-700">
              <CalendarDays className="h-4 w-4 text-slate-400" />
              Lịch phân ca
            </span>
            <span className="flex items-center gap-1 text-indigo-600">
              Xem lịch phân ca
              <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        </div>

        <div className="mt-6 space-y-2">
          <button
            type="button"
            onClick={() => onEdit(shift)}
            className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-sm font-semibold text-white shadow-sm"
          >
            Chỉnh sửa ca
          </button>
          {shift.status === "active" && (
            <button
              type="button"
              disabled={deactivating}
              onClick={() => onDeactivate(shift)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200 py-2.5 text-sm font-semibold text-rose-500 hover:bg-rose-50 disabled:opacity-60"
            >
              <CircleStop className="h-4 w-4" />
              {deactivating ? "Đang cập nhật..." : "Ngừng hoạt động"}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
