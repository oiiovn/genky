"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CalendarCheck,
  FileText,
  Gift,
  Umbrella,
  UserPlus,
  Users,
} from "lucide-react";
import type { DashboardData } from "@/types/dashboard";

const notifIcon = {
  warning: { Icon: AlertTriangle, className: "bg-orange-50 text-orange-500" },
  shift: { Icon: CalendarCheck, className: "bg-emerald-50 text-emerald-600" },
  document: { Icon: FileText, className: "bg-amber-50 text-amber-600" },
  leave: { Icon: Umbrella, className: "bg-rose-50 text-rose-500" },
  employee: { Icon: UserPlus, className: "bg-sky-50 text-sky-500" },
  reward: { Icon: Gift, className: "bg-violet-50 text-violet-500" },
};

export function UpcomingShifts({
  shifts,
}: {
  shifts: DashboardData["upcoming_shifts"];
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-800">
          Ca làm sắp tới
        </h2>
        <Link
          href="/schedule"
          className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
        >
          Xem lịch
        </Link>
      </div>

      <ul className="space-y-3">
        {shifts.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
            Chưa có ca làm — module ca làm sẽ bổ sung sau
          </li>
        ) : (
          shifts.map((shift, idx) => (
            <li
              key={`${shift.date}-${shift.name}-${idx}`}
              className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5"
            >
              <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <span className="text-base font-bold leading-none">{shift.date}</span>
                <span className="text-[10px] font-medium">{shift.month}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-800">{shift.name}</p>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <Users className="h-3 w-3" />
                  {shift.employees} nhân viên
                </p>
              </div>
              <span className="text-xs font-medium text-slate-500">{shift.time}</span>
            </li>
          ))
        )}
      </ul>

      <Link
        href="/shifts"
        className="mt-3 block w-full text-center text-xs font-medium text-indigo-600 hover:text-indigo-700"
      >
        Xem tất cả ca làm
      </Link>
    </section>
  );
}

export function Notifications({
  items,
}: {
  items: DashboardData["notifications"];
}) {
  return (
    <section
      id="notifications"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="mb-4 text-base font-semibold text-slate-800">Thông báo</h2>
      <ul className="space-y-3">
        {items.length === 0 ? (
          <li className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">
            Chưa có thông báo
          </li>
        ) : (
          items.map((item) => {
            const meta = notifIcon[item.type] ?? notifIcon.document;
            const Icon = meta.Icon;
            return (
              <li key={String(item.id)} className="flex items-start gap-3">
                {item.type === "leave" ? (
                  <a
                    href="#leaves"
                    className="flex min-w-0 flex-1 items-start gap-3"
                  >
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.className}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {item.title}
                      </p>
                      {item.message ? (
                        <p className="text-xs text-slate-500">{item.message}</p>
                      ) : null}
                      <p className="text-xs text-slate-400">{item.time}</p>
                    </div>
                  </a>
                ) : (
                  <>
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.className}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">
                        {item.title}
                      </p>
                      {item.message ? (
                        <p className="text-xs text-slate-500">{item.message}</p>
                      ) : null}
                      <p className="text-xs text-slate-400">{item.time}</p>
                    </div>
                  </>
                )}
              </li>
            );
          })
        )}
      </ul>
    </section>
  );
}
