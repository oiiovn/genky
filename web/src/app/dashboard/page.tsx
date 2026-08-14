"use client";

import { useCallback, useEffect, useState } from "react";
import { AttendanceTable } from "@/components/dashboard/AttendanceTable";
import { Header } from "@/components/dashboard/Header";
import { KpiCards } from "@/components/dashboard/KpiCards";
import { LeaveInbox } from "@/components/dashboard/LeaveInbox";
import { PerformanceCard } from "@/components/dashboard/PerformanceCard";
import { PersonnelCosts } from "@/components/dashboard/PersonnelCosts";
import { SalaryProjection } from "@/components/dashboard/SalaryProjection";
import { Sidebar } from "@/components/dashboard/Sidebar";
import {
  Notifications,
  UpcomingShifts,
} from "@/components/dashboard/SideWidgets";
import { fetchDashboard, getAccessToken, me } from "@/lib/api";
import { isStaffAppUser } from "@/lib/staff";
import { hardReplace } from "@/lib/nav";
import type { DashboardData } from "@/types/dashboard";

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function boot() {
      if (!getAccessToken()) {
        hardReplace("/login");
        return;
      }

      try {
        const profile = await me();
        if (profile.setup && !profile.setup.setup_completed) {
          hardReplace(
            profile.setup.next_step === "branch"
              ? "/onboarding/branch"
              : "/onboarding",
          );
          return;
        }
        if (isStaffAppUser(profile)) {
          hardReplace("/m");
          return;
        }

        const dashboard = await fetchDashboard();
        setData(dashboard);
      } catch {
        hardReplace("/login");
        return;
      } finally {
        setLoading(false);
      }
    }

    void boot();
  }, []);

  const reload = useCallback(async () => {
    const dashboard = await fetchDashboard();
    setData(dashboard);
  }, []);

  const ready = data !== null;

  useEffect(() => {
    if (!ready) return;
    const timer = window.setInterval(() => {
      void reload();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [ready, reload]);

  if (loading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] text-slate-500">
        Đang tải...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F3F4F6]">
      <Sidebar tenant={data.tenant} active="Tổng quan" access={data.access} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header data={data} />

        <main className="flex-1 space-y-5 overflow-y-auto p-5 lg:p-6">
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
        </main>
      </div>
    </div>
  );
}
