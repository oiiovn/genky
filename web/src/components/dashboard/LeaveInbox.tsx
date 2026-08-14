"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  MessageSquare,
  Umbrella,
  X,
} from "lucide-react";
import { reviewLeave } from "@/lib/leave-api";
import type { DashboardData } from "@/types/dashboard";

export function LeaveInbox({
  items,
  onChanged,
}: {
  items: NonNullable<DashboardData["pending_leaves"]>;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (items.length === 0) return null;

  async function review(id: number, status: "approved" | "rejected") {
    setBusyId(id);
    setError(null);
    try {
      await reviewLeave(id, status);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không duyệt được đơn.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section
      id="leaves"
      className="rounded-2xl border border-rose-100 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500 text-white">
            <Bell className="h-4 w-4" />
          </div>
          <h2 className="text-base font-semibold text-slate-800">
            Đơn nghỉ chờ duyệt
          </h2>
        </div>
        <Link
          href="/leaves"
          className="flex items-center gap-1.5 text-rose-500 hover:text-rose-600"
        >
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-bold text-white">
            {items.length}
          </span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {error ? (
        <p className="mb-3 text-xs text-rose-600">{error}</p>
      ) : null}

      <ul className="space-y-3">
        {items.map((row) => (
          <li
            key={row.id}
            className="overflow-hidden rounded-xl border border-rose-100 bg-white"
          >
            <div className="flex">
              <div className="w-1 shrink-0 bg-rose-400" />
              <div className="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:flex-row sm:items-start sm:justify-between sm:p-3.5">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                    <Umbrella className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {row.full_name} xin {row.type_label}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5 text-slate-400" />
                        {row.from} → {row.to}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        {row.days} ngày
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                        {row.time}
                      </span>
                    </div>
                    {row.reason ? (
                      <p className="mt-1.5 inline-flex items-start gap-1.5 text-xs text-slate-500">
                        <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="break-words">{row.reason}</span>
                      </p>
                    ) : null}
                  </div>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-2 sm:pl-3">
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
                    <Clock className="h-3 w-3" />
                    Chờ duyệt
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void review(row.id, "approved")}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-50 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Duyệt
                    </button>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void review(row.id, "rejected")}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-xs font-semibold text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Từ chối
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
