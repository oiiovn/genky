"use client";

import { useCallback, useEffect, useState } from "react";
import { AttendanceTable } from "@/components/dashboard/AttendanceTable";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { LeaveInbox } from "@/components/dashboard/LeaveInbox";
import { PerformanceCard } from "@/components/dashboard/PerformanceCard";
import dynamic from "next/dynamic";
import {
  Notifications,
  UpcomingShifts,
} from "@/components/dashboard/SideWidgets";
import { fetchDashboard } from "@/lib/api";
import { useVisibleInterval } from "@/lib/use-visible-interval";
import type { DashboardData } from "@/types/dashboard";

const SalaryProjection = dynamic(
  () =>
    import("@/components/dashboard/SalaryProjection").then(
      (mod) => mod.SalaryProjection,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[260px] animate-pulse rounded-2xl bg-indigo-100" />
    ),
  },
);

const PersonnelCosts = dynamic(
  () =>
    import("@/components/dashboard/PersonnelCosts").then(
      (mod) => mod.PersonnelCosts,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[280px] animate-pulse rounded-2xl bg-white" />
    ),
  },
);

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchDashboard()
      .then((dashboard) => {
        if (!cancelled) setData(dashboard);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const reload = useCallback(async () => {
    setData(await fetchDashboard());
  }, []);

  useVisibleInterval(() => {
    void reload();
  }, 15_000, data !== null);

  return (
    <main className="flex-1 space-y-5 overflow-y-auto p-5 lg:p-6">
      {!data ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-500">
          Đang tải tổng quan...
        </div>
      ) : null}
      {data ? (
        <>
          <LeaveInbox
            items={data.pending_leaves ?? []}
            onChanged={() => void reload()}
          />

          <KpiCards kpis={data.kpis} />

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-5">
            <div className="xl:col-span-3">
              <AttendanceTable rows={data.attendance_today} />
            </div>
            <div className="xl:col-span-2">
              <SalaryProjection data={data.salary_projection} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
            <PersonnelCosts data={data.personnel_costs} />
            <PerformanceCard data={data.performance} />
            <div className="space-y-5">
              <UpcomingShifts shifts={data.upcoming_shifts} />
              <Notifications items={data.notifications} />
            </div>
          </div>
        </>
      ) : null}
    </main>
  );
}
