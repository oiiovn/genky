"use client";

import Link from "next/link";
import clsx from "clsx";
import type { QrHistoryRow } from "@/lib/attendance-qr-api";

const STEPS = [
  "Mở ứng dụng Freshh trên điện thoại",
  "Đăng nhập bằng tài khoản nhân viên",
  "Chọn chức năng Quét QR chấm công",
  "Hướng camera vào mã QR trên màn hình này",
];

export function QrSideInfo({
  history,
  branchId,
}: {
  history: QrHistoryRow[];
  branchId?: number;
}) {
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-800">
          Hướng dẫn chấm công
        </h3>
        <ol className="mt-3 space-y-2.5">
          {STEPS.map((step, i) => (
            <li key={step} className="flex items-start gap-2.5 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">
                {i + 1}
              </span>
              <span className="text-slate-600">{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-4 rounded-xl border border-sky-100 bg-sky-50 px-3 py-2.5 text-xs text-sky-700">
          Đứng yên và giữ điện thoại ổn định khi quét. Đảm bảo đủ ánh sáng để
          camera nhận diện QR rõ.
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-slate-800">
            Lịch sử chấm công gần đây
          </h3>
          <Link
            href={
              branchId
                ? `/attendance?branch_id=${branchId}`
                : "/attendance"
            }
            className="text-xs font-semibold text-indigo-600"
          >
            Xem tất cả
          </Link>
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-slate-400">
            Chưa có lịch sử quét tại chi nhánh này.
          </p>
        ) : (
          <ul className="space-y-3">
            {history.map((row) => (
              <li key={row.id} className="flex items-start gap-2.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    row.avatar ||
                    `https://i.pravatar.cc/80?u=${encodeURIComponent(String(row.employee_id))}`
                  }
                  alt=""
                  className="h-9 w-9 rounded-full object-cover"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-800">
                      {row.full_name}
                    </p>
                    <span
                      className={clsx(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        row.action === "check_in"
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-amber-50 text-amber-600",
                      )}
                    >
                      {row.action_label}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {row.shift_label}
                  </p>
                  <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-400">
                    <span>{row.time}</span>
                    <span className="text-emerald-600">Thành công</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
