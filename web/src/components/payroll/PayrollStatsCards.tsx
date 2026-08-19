"use client";

import clsx from "clsx";
import {
  BadgeCheck,
  CreditCard,
  Users,
  Wallet,
} from "lucide-react";
import { formatMoney, type PayrollStats } from "@/lib/payroll";

export function PayrollStatsCards({ stats }: { stats: PayrollStats }) {
  const net = stats.net ?? stats.fund;
  const paidAmount = stats.paid_amount ?? 0;
  const remaining = stats.remaining ?? Math.max(0, net - paidAmount);
  const paidPercent = Math.max(0, Math.min(100, stats.paid_percent));

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">Nhân viên</p>
            <p className="mt-1 text-lg font-bold text-slate-800">
              {stats.employees} nhân viên
            </p>
            <p className="mt-1 text-xs text-slate-400">Trong bảng lương tháng này</p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
            <Users className="h-5 w-5" />
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">Tổng thu nhập</p>
            <p className="mt-1 truncate text-lg font-bold text-slate-800">
              {formatMoney(stats.income)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Lương + phụ cấp + thưởng + OT, trước khấu trừ
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
            <Wallet className="h-5 w-5" />
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">Thực nhận</p>
            <p className="mt-1 truncate text-lg font-bold text-slate-800">
              {formatMoney(net)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Số tiền sau khấu trừ · phải trả tháng này
            </p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-500">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>
      </article>

      <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm text-slate-500">Đã thanh toán</p>
            <p className="mt-1 truncate text-lg font-bold text-slate-800">
              {formatMoney(paidAmount)}
              <span className="text-sm font-medium text-slate-400">
                {" "}
                / {formatMoney(net)}
              </span>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {paidPercent.toFixed(0)}% · Còn nợ {formatMoney(remaining)}
            </p>
          </div>
          <div
            className={clsx(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              paidPercent >= 100
                ? "bg-emerald-50 text-emerald-500"
                : "bg-violet-50 text-violet-500",
            )}
          >
            <BadgeCheck className="h-5 w-5" />
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={clsx(
              "h-full rounded-full",
              paidPercent >= 100 ? "bg-emerald-500" : "bg-violet-500",
            )}
            style={{ width: `${paidPercent}%` }}
          />
        </div>
      </article>
    </div>
  );
}
