"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Settings2,
} from "lucide-react";
import { useAdminChrome } from "@/components/admin/AdminShell";
import { Header } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { TimesheetSidePanel } from "@/components/timesheet/TimesheetSidePanel";
import { TimesheetStatsCards } from "@/components/timesheet/TimesheetStatsCards";
import {
  TimesheetTable,
  type TimesheetTab,
} from "@/components/timesheet/TimesheetTable";
import { fetchShifts, type Shift } from "@/lib/shifts-api";
import {
  approveTimesheets,
  exportTimesheets,
  fetchTimesheets,
  generateTimesheet,
  monthBounds,
  type TimesheetRow,
  type TimesheetStats,
  type TimesheetStatus,
} from "@/lib/timesheet-api";
import { currentMonth, currentYear } from "@/lib/timezone";

const emptyStats: TimesheetStats = {
  employees: 0,
  work_minutes: 0,
  ot_minutes: 0,
  avg_work_days: 0,
  estimated_cost: 0,
  employees_delta: 0,
  work_hours_delta: 0,
  ot_delta: 0,
  avg_days_delta: 0,
  cost_delta: 0,
};

export default function TimesheetPage() {
  const { shell, branches, headerData } = useAdminChrome(
    "Quản lý bảng công và tổng hợp giờ làm của nhân viên",
  );
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [tab, setTab] = useState<TimesheetTab>("all");
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<number | "">("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [shiftFilter, setShiftFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | TimesheetStatus>("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<TimesheetRow[]>([]);
  const [stats, setStats] = useState<TimesheetStats>(emptyStats);
  const [departments, setDepartments] = useState<string[]>([]);
  const [approvedCount, setApprovedCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  const bounds = useMemo(() => monthBounds(year, month), [year, month]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const res = await fetchTimesheets({
        year,
        month,
        branch_id: branchFilter,
        department: departmentFilter || undefined,
        shift_id: shiftFilter,
        status: statusFilter,
        search: search.trim() || undefined,
        page,
        per_page: perPage,
      });
      setRows(res.data ?? []);
      setTotal(res.meta?.total ?? 0);
      setPage(res.meta?.current_page ?? 1);
      setLastPage(res.meta?.last_page ?? 1);
      setStats(res.stats ?? emptyStats);
      setDepartments(res.departments ?? []);
      setApprovedCount(res.summary?.approved ?? 0);
      setPendingCount(res.summary?.pending ?? 0);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tải được bảng công.",
      );
    } finally {
      setListLoading(false);
    }
  }, [
    year,
    month,
    branchFilter,
    departmentFilter,
    shiftFilter,
    statusFilter,
    search,
    page,
    perPage,
  ]);

  useEffect(() => {
    async function boot() {
      try {
        const shiftList = await fetchShifts({
          status: "active",
          per_page: 50,
        }).catch(() => ({ data: [] as Shift[] }));
        setShifts(shiftList.data);
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList, reloadKey]);

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setPage(1);
    setSelectedIds([]);
  }

  async function handleApprove(ids: number[]) {
    if (ids.length === 0) {
      showToast("Không có dòng chờ duyệt");
      return;
    }
    try {
      const res = await approveTimesheets({
        year,
        month,
        employee_ids: ids,
        status: "approved",
      });
      showToast(`Đã duyệt ${res.count} dòng`);
      setSelectedIds([]);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Duyệt thất bại.");
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] text-slate-500">
        Đang tải...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F3F4F6]">
      <Sidebar tenant={shell.tenant} active="Bảng công" access={shell.access} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          data={headerData}
          subtitle="Quản lý bảng công và tổng hợp giờ làm của nhân viên"
        />

        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Bảng công</h2>
              <p className="text-sm text-slate-500">
                Tổng hợp ngày công, giờ làm và trạng thái duyệt theo tháng
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="px-2.5 py-2 text-slate-500 hover:bg-slate-50"
                  aria-label="Tháng trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="border-x border-slate-200 px-3 py-2 text-sm font-medium text-slate-700">
                  {bounds.label}
                </span>
                <button
                  type="button"
                  onClick={() => shiftMonth(1)}
                  className="px-2.5 py-2 text-slate-500 hover:bg-slate-50"
                  aria-label="Tháng sau"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => showToast("Cài đặt bảng công sắp có")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
              >
                <Settings2 className="h-4 w-4" />
                Cài đặt bảng công
              </button>
              <button
                type="button"
                onClick={() => {
                  void exportTimesheets({
                    year,
                    month,
                    branch_id: branchFilter,
                    department: departmentFilter || undefined,
                    shift_id: shiftFilter,
                    status: statusFilter,
                    search: search.trim() || undefined,
                  }).catch((err) =>
                    setError(
                      err instanceof Error ? err.message : "Xuất file thất bại.",
                    ),
                  );
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
              >
                <Download className="h-4 w-4 text-emerald-500" />
                Xuất Excel
              </button>
              <button
                type="button"
                onClick={() => {
                  void generateTimesheet({
                    year,
                    month,
                    branch_id: branchFilter || null,
                  })
                    .then((res) => {
                      showToast(
                        `Đã tạo bảng công (${res.created} mới / ${res.total_employees} NV)`,
                      );
                      setReloadKey((k) => k + 1);
                    })
                    .catch((err) =>
                      setError(
                        err instanceof Error
                          ? err.message
                          : "Không tạo được bảng công.",
                      ),
                    );
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Tạo bảng công
              </button>
            </div>
          </div>

          <TimesheetStatsCards stats={stats} />

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-5 xl:flex-row">
            <div className="min-w-0 flex-1">
              <TimesheetTable
                rows={rows}
                total={total}
                page={page}
                lastPage={lastPage}
                perPage={perPage}
                selectedIds={selectedIds}
                loading={listLoading}
                tab={tab}
                search={search}
                branchFilter={branchFilter}
                departmentFilter={departmentFilter}
                shiftFilter={shiftFilter}
                statusFilter={statusFilter}
                branches={branches}
                departments={departments}
                shifts={shifts.map((s) => ({ id: s.id, name: s.name }))}
                onTabChange={(t) => {
                  setTab(t);
                  setPage(1);
                }}
                onSearchChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                onBranchChange={(v) => {
                  setBranchFilter(v);
                  setPage(1);
                }}
                onDepartmentChange={(v) => {
                  setDepartmentFilter(v);
                  setPage(1);
                }}
                onShiftChange={(v) => {
                  setShiftFilter(v);
                  setPage(1);
                }}
                onStatusChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
                onToggleRow={(id) => {
                  setSelectedIds((prev) =>
                    prev.includes(id)
                      ? prev.filter((x) => x !== id)
                      : [...prev, id],
                  );
                }}
                onToggleAll={() => {
                  const ids = rows.map((r) => r.id);
                  const allOn = ids.every((id) => selectedIds.includes(id));
                  setSelectedIds((prev) =>
                    allOn
                      ? prev.filter((id) => !ids.includes(id))
                      : Array.from(new Set([...prev, ...ids])),
                  );
                }}
                onPageChange={setPage}
                onPerPageChange={(n) => {
                  setPerPage(n);
                  setPage(1);
                }}
                onApprove={(id) => {
                  void handleApprove([id]);
                }}
              />
            </div>

            <TimesheetSidePanel
              stats={stats}
              approvedCount={approvedCount}
              pendingCount={pendingCount}
              onAction={(action) => {
                if (action === "approve") {
                  const targets =
                    selectedIds.length > 0
                      ? selectedIds
                      : rows
                          .filter((r) => r.status === "pending")
                          .map((r) => r.id);
                  void handleApprove(targets);
                  return;
                }
                if (action === "print") {
                  window.print();
                  return;
                }
                if (action === "export") {
                  void exportTimesheets({
                    year,
                    month,
                    branch_id: branchFilter,
                    department: departmentFilter || undefined,
                    shift_id: shiftFilter,
                    status: statusFilter,
                    search: search.trim() || undefined,
                  }).catch((err) =>
                    setError(
                      err instanceof Error ? err.message : "Xuất file thất bại.",
                    ),
                  );
                  return;
                }
                showToast("Tính năng sẽ sớm có sẵn");
              }}
            />
          </div>
        </main>
      </div>

      {toast ? (
        <div className="fixed right-5 bottom-5 z-50 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
