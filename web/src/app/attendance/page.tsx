"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, Download } from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AttendanceSidePanel } from "@/components/attendance/AttendanceSidePanel";
import { AttendanceStatsCards } from "@/components/attendance/AttendanceStatsCards";
import { AttendanceTable } from "@/components/attendance/AttendanceTable";
import { AttendanceRecordModal } from "@/components/attendance/AttendanceRecordModal";
import { QuickAttendanceModal } from "@/components/attendance/QuickAttendanceModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  fetchBranches,
  fetchDashboard,
  getAccessToken,
  me,
  type Branch,
} from "@/lib/api";
import {
  deleteAttendance,
  exportAttendances,
  fetchAttendanceDashboard,
  fetchAttendances,
  fetchAttendanceShiftsToday,
  type AttendanceRow,
  type AttendanceStats,
  type AttendanceUiStatus,
  type ShiftTodayCard,
} from "@/lib/attendance-api";
import { fetchEmployees, type Employee } from "@/lib/employees-api";
import { fetchShifts, type Shift } from "@/lib/shifts-api";
import type { DashboardData } from "@/types/dashboard";
import { todayIso } from "@/lib/timezone";

const emptyStats: AttendanceStats = {
  total: 0,
  checked_in: 0,
  working: 0,
  not_checked_in: 0,
  on_leave: 0,
};

export default function AttendancePage() {
  const router = useRouter();
  const [shell, setShell] = useState<DashboardData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState(todayIso());
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<number | "">("");
  const [shiftFilter, setShiftFilter] = useState<number | "">("");
  const [statusFilter, setStatusFilter] = useState<"" | AttendanceUiStatus>("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [stats, setStats] = useState<AttendanceStats>(emptyStats);
  const [shiftsToday, setShiftsToday] = useState<ShiftTodayCard[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [recordModal, setRecordModal] = useState<{
    mode: "view" | "edit";
    row: AttendanceRow;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AttendanceRow | null>(
    null,
  );
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadAll = useCallback(
    async (opts?: {
      date?: string;
      branch_id?: number | "";
      shift_id?: number | "";
      status?: "" | AttendanceUiStatus;
      search?: string;
      page?: number;
    }) => {
      setListLoading(true);
      setError(null);
      const d = opts?.date ?? date;
      const branchId = opts?.branch_id ?? branchFilter;
      const shiftId = opts?.shift_id ?? shiftFilter;
      const status = opts?.status ?? statusFilter;
      const q = opts?.search ?? appliedSearch;
      const p = opts?.page ?? page;

      try {
        const [list, dash, today] = await Promise.all([
          fetchAttendances({
            date: d,
            branch_id: branchId,
            shift_id: shiftId,
            status: status || undefined,
            search: q || undefined,
            page: p,
            per_page: 10,
          }),
          fetchAttendanceDashboard({ date: d, branch_id: branchId }),
          fetchAttendanceShiftsToday({ date: d, branch_id: branchId }),
        ]);
        setRows(list.data ?? []);
        setTotal(list.meta?.total ?? 0);
        setPage(list.meta?.current_page ?? 1);
        setLastPage(list.meta?.last_page ?? 1);
        setStats(dash);
        setShiftsToday(today);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được chấm công.");
      } finally {
        setListLoading(false);
      }
    },
    [date, branchFilter, shiftFilter, statusFilter, appliedSearch, page],
  );

  useEffect(() => {
    async function boot() {
      if (!getAccessToken()) {
        setLoading(false);
        router.replace("/login");
        return;
      }
      try {
        const profile = await me();
        if (profile.setup && !profile.setup.setup_completed) {
          setLoading(false);
          router.replace(
            profile.setup.next_step === "branch"
              ? "/onboarding/branch"
              : "/onboarding",
          );
          return;
        }
        const [dashboard, branchList, shiftList, empList] = await Promise.all([
          fetchDashboard(),
          fetchBranches().catch(() => [] as Branch[]),
          fetchShifts({ per_page: 50 }).catch(() => ({
            data: [] as Shift[],
            meta: { current_page: 1, last_page: 1, per_page: 50, total: 0 },
          })),
          fetchEmployees({ per_page: 100, status: "active" }).catch(() => ({
            data: [] as Employee[],
            meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 },
          })),
        ]);
        setShell(dashboard);
        setBranches(branchList);
        setShifts(shiftList.data);
        setEmployees(empList.data);
        setLoading(false);
        await loadAll({ page: 1 });
      } catch {
        setLoading(false);
        router.replace("/login");
      }
    }
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const headerData = useMemo(() => {
    if (!shell) return null;
    return {
      ...shell,
      greeting: {
        ...shell.greeting,
        message: "Quản lý chấm công và thời gian làm việc của nhân viên",
      },
    };
  }, [shell]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
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
      <Sidebar tenant={shell.tenant} active="Chấm công" access={shell.access} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          data={headerData}
          subtitle="Quản lý chấm công và thời gian làm việc của nhân viên"
        />

        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Chấm công</h2>
              <p className="text-sm text-slate-500">
                Theo dõi check-in / check-out theo ca và chi nhánh
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void exportAttendances({
                    date,
                    branch_id: branchFilter,
                  }).catch((err) =>
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Xuất file thất bại.",
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
                onClick={() => setModalOpen(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
              >
                Check-in / Check-out
                <ChevronDown className="h-4 w-4 opacity-80" />
              </button>
              <Link
                href="/attendance/qr"
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-sm font-semibold text-indigo-600"
              >
                QR chấm công
              </Link>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </div>
          )}

          <AttendanceStatsCards stats={stats} />

          <div className="mt-5 flex flex-col gap-5 xl:flex-row">
            <div className="min-w-0 flex-1">
              <AttendanceTable
                rows={rows}
                total={total}
                page={page}
                lastPage={lastPage}
                search={search}
                date={date}
                branchFilter={branchFilter === "" ? "" : String(branchFilter)}
                shiftFilter={shiftFilter === "" ? "" : String(shiftFilter)}
                statusFilter={statusFilter}
                branches={branches.map((b) => ({
                  id: String(b.id),
                  name: b.name,
                }))}
                shifts={shifts.map((s) => ({
                  id: String(s.id),
                  name: s.name,
                }))}
                loading={listLoading}
                onSearchChange={setSearch}
                onSearchSubmit={() => {
                  setAppliedSearch(search);
                  void loadAll({ search, page: 1 });
                }}
                onDateChange={(v) => {
                  setDate(v);
                  void loadAll({ date: v, page: 1 });
                }}
                onBranchChange={(v) => {
                  const id = v ? Number(v) : "";
                  setBranchFilter(id);
                  void loadAll({ branch_id: id, page: 1 });
                }}
                onShiftChange={(v) => {
                  const id = v ? Number(v) : "";
                  setShiftFilter(id);
                  void loadAll({ shift_id: id, page: 1 });
                }}
                onStatusChange={(v) => {
                  setStatusFilter(v);
                  void loadAll({ status: v, page: 1 });
                }}
                onPageChange={(p) => {
                  void loadAll({ page: p });
                }}
                onView={(row) => setRecordModal({ mode: "view", row })}
                onEdit={(row) => setRecordModal({ mode: "edit", row })}
                onDelete={(row) => {
                  if (!row.id) {
                    setError("Chưa có bản ghi để xoá.");
                    return;
                  }
                  setPendingDelete(row);
                }}
              />
            </div>

            <AttendanceSidePanel
              stats={stats}
              shifts={shiftsToday}
            />
          </div>
        </main>
      </div>

      {modalOpen ? (
        <QuickAttendanceModal
          open={modalOpen}
          employees={employees}
          branches={branches}
          shifts={shifts}
          date={date}
          defaultBranchId={
            typeof branchFilter === "number"
              ? branchFilter
              : branches[0]?.id
          }
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            showToast("Đã cập nhật chấm công.");
            void loadAll();
          }}
        />
      ) : null}

      {recordModal && (
        <AttendanceRecordModal
          open
          mode={recordModal.mode}
          row={recordModal.row}
          shifts={shifts}
          onClose={() => setRecordModal(null)}
          onEdit={() =>
            setRecordModal({ mode: "edit", row: recordModal.row })
          }
          onSaved={() => {
            showToast("Đã lưu chấm công.");
            void loadAll();
          }}
        />
      )}

      {pendingDelete ? (
        <ConfirmDialog
          open
          title="Xóa chấm công"
          message={`Xóa chấm công của ${pendingDelete.full_name} ngày ${pendingDelete.work_date}?`}
          loading={deleting}
          onClose={() => {
            if (!deleting) setPendingDelete(null);
          }}
          onConfirm={() => {
            if (!pendingDelete.id) return;
            setDeleting(true);
            void deleteAttendance(pendingDelete.id)
              .then(() => {
                setPendingDelete(null);
                showToast("Đã xoá bản ghi chấm công.");
                void loadAll();
              })
              .catch((err) =>
                setError(
                  err instanceof Error ? err.message : "Không thể xoá bản ghi.",
                ),
              )
              .finally(() => setDeleting(false));
          }}
        />
      ) : null}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <span className="rounded-full bg-slate-900/85 px-4 py-2 text-sm text-white">
            {toast}
          </span>
        </div>
      )}
    </div>
  );
}
