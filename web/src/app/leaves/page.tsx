"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { LeaveFormModal } from "@/components/leaves/LeaveFormModal";
import { LeaveStatsCards } from "@/components/leaves/LeaveStatsCards";
import { LeaveTable } from "@/components/leaves/LeaveTable";
import { fetchDashboard, getAccessToken, me } from "@/lib/api";
import { fetchEmployees, type Employee } from "@/lib/employees-api";
import {
  fetchLeaves,
  reviewLeave,
  type LeaveRequest,
  type LeaveStats,
} from "@/lib/leave-api";
import { isStaffAppUser } from "@/lib/staff";
import type { DashboardData } from "@/types/dashboard";

const emptyStats: LeaveStats = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
};

export default function LeavesPage() {
  const router = useRouter();
  const [shell, setShell] = useState<DashboardData | null>(null);
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [stats, setStats] = useState<LeaveStats>(emptyStats);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const res = await fetchLeaves({
        status: status || undefined,
        type: type || undefined,
        search: appliedSearch || undefined,
      });
      setRows(res.data);
      setStats(res.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được đơn nghỉ.");
    } finally {
      setListLoading(false);
    }
  }, [status, type, appliedSearch]);

  useEffect(() => {
    const t = window.setTimeout(() => setAppliedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    async function boot() {
      if (!getAccessToken()) {
        router.replace("/login");
        return;
      }
      try {
        const profile = await me();
        if (profile.setup && !profile.setup.setup_completed) {
          router.replace(
            profile.setup.next_step === "branch"
              ? "/onboarding/branch"
              : "/onboarding",
          );
          return;
        }
        if (isStaffAppUser(profile)) {
          router.replace("/m/leave");
          return;
        }
        const [dashboard, empList] = await Promise.all([
          fetchDashboard(),
          fetchEmployees({ status: "active", per_page: 100 }).catch(() => null),
        ]);
        setShell(dashboard);
        setEmployees(empList?.data ?? []);
      } catch {
        router.replace("/login");
        return;
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, [router]);

  useEffect(() => {
    if (!shell) return;
    void loadList();
  }, [shell, loadList]);

  const headerData = useMemo(() => {
    if (!shell) return null;
    return {
      ...shell,
      greeting: {
        ...shell.greeting,
        message: "Duyệt và quản lý đơn nghỉ phép của nhân viên",
      },
    };
  }, [shell]);

  async function review(id: number, next: "approved" | "rejected") {
    setBusyId(id);
    setError(null);
    try {
      await reviewLeave(id, next);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không duyệt được đơn.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading || !shell || !headerData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] text-slate-500">
        Đang tải...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F3F4F6]">
      <Sidebar tenant={shell.tenant} active="Nghỉ phép" access={shell.access} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          data={headerData}
          subtitle="Duyệt và quản lý đơn nghỉ phép của nhân viên"
        />

        <main className="flex-1 space-y-5 overflow-y-auto p-5 lg:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Nghỉ phép</h2>
              <p className="text-sm text-slate-500">
                Theo dõi đơn xin nghỉ và duyệt cho nhân viên
              </p>
            </div>
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-600"
            >
              <Plus className="h-4 w-4" />
              Tạo đơn nghỉ
            </button>
          </div>

          <LeaveStatsCards stats={stats} />

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </p>
          ) : null}

          <LeaveTable
            rows={rows}
            search={search}
            status={status}
            type={type}
            loading={listLoading}
            busyId={busyId}
            onSearchChange={setSearch}
            onStatusChange={setStatus}
            onTypeChange={setType}
            onApprove={(row) => void review(row.id, "approved")}
            onReject={(row) => void review(row.id, "rejected")}
          />
        </main>
      </div>

      <LeaveFormModal
        open={modalOpen}
        employees={employees}
        onClose={() => setModalOpen(false)}
        onSaved={() => void loadList()}
      />
    </div>
  );
}
