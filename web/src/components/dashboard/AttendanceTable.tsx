"use client";

import clsx from "clsx";
import { MoreHorizontal } from "lucide-react";
import type { AttendanceRow } from "@/types/dashboard";

const statusStyle = {
  on_time: "bg-emerald-50 text-emerald-600",
  late: "bg-rose-50 text-rose-600",
  pending: "bg-amber-50 text-amber-600",
  on_leave: "bg-violet-50 text-violet-600",
};

export function AttendanceTable({ rows }: { rows: AttendanceRow[] }) {
  return (
    <section className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-800">
          Tình hình chấm công hôm nay
        </h2>
        <button
          type="button"
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Xem tất cả
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs tracking-wide text-slate-400 uppercase">
              <th className="px-5 py-3 font-medium">Nhân viên</th>
              <th className="px-3 py-3 font-medium">Ca làm</th>
              <th className="px-3 py-3 font-medium">Check-in</th>
              <th className="px-3 py-3 font-medium">Trạng thái</th>
              <th className="px-3 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-10 text-center text-sm text-slate-400"
                >
                  Chưa có nhân viên. Thêm nhân viên để hiển thị tại đây.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
              <tr
                key={row.id}
                className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60"
              >
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={row.avatar}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-medium text-slate-800">{row.name}</p>
                      <p className="text-xs text-slate-400">{row.role}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-slate-600">{row.shift}</td>
                <td className="px-3 py-3 font-medium text-slate-700">
                  {row.check_in ?? "—"}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={clsx(
                      "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                      statusStyle[row.status],
                    )}
                  >
                    {row.status_label}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <button
                    type="button"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                    aria-label="Thêm"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
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
