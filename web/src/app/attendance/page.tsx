"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Download } from "lucide-react";
import dynamic from "next/dynamic";
import { useAdminChrome } from "@/components/admin/AdminShell";
import { AttendanceStatsCards } from "@/components/attendance/AttendanceStatsCards";
import { AttendanceTable } from "@/components/attendance/AttendanceTable";
import { MobileAttendance } from "@/components/attendance/MobileAttendance";
import { AttendanceRecordModal } from "@/components/attendance/AttendanceRecordModal";
import { QuickAttendanceModal } from "@/components/attendance/QuickAttendanceModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  deleteAttendance,
  deleteSyntheticAttendance,
  exportAttendances,
  fetchAttendanceOverview,
  fetchAttendances,
  type AttendanceRow,
  type AttendanceStats,
  type AttendanceUiStatus,
  type ShiftTodayCard,
} from "@/lib/attendance-api";
import { fetchEmployees, type Employee } from "@/lib/employees-api";
import { fetchShifts, type Shift } from "@/lib/shifts-api";
import { recentDaysRange } from "@/lib/timezone";

const AttendanceSidePanel = dynamic(
  () =>
    import("@/components/attendance/AttendanceSidePanel").then(
      (mod) => mod.AttendanceSidePanel,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] w-full max-w-sm animate-pulse rounded-2xl bg-white" />
    ),
  },
);

const emptyStats: AttendanceStats = {
  total: 0,
  checked_in: 0,
  working: 0,
  not_checked_in: 0,
  on_leave: 0,
};

export default function AttendancePage() {
  const { branches } = useAdminChrome();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const range = recentDaysRange(7);
  const [dateFrom, setDateFrom] = useState(range.from);
  const [dateTo, setDateTo] = useState(range.to);
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

  const loadList = useCallback(
    async (opts?: {
      from?: string;
      to?: string;
      branch_id?: number | "";
      shift_id?: number | "";
      status?: "" | AttendanceUiStatus;
      search?: string;
      page?: number;
    }) => {
      setListLoading(true);
      setError(null);
      const from = opts?.from ?? dateFrom;
      const to = opts?.to ?? dateTo;
      const branchId = opts?.branch_id ?? branchFilter;
      const shiftId = opts?.shift_id ?? shiftFilter;
      const status = opts?.status ?? statusFilter;
      const q = opts?.search ?? appliedSearch;
      const p = opts?.page ?? page;

      try {
        const list = await fetchAttendances({
          from,
          to,
          branch_id: branchId,
          shift_id: shiftId,
          status: status || undefined,
          search: q || undefined,
          page: p,
          per_page: 10,
        });
        setRows(list.data ?? []);
        setTotal(list.meta?.total ?? 0);
        setPage(list.meta?.current_page ?? 1);
        setLastPage(list.meta?.last_page ?? 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được chấm công.");
      } finally {
        setListLoading(false);
      }
    },
    [dateFrom, dateTo, branchFilter, shiftFilter, statusFilter, appliedSearch, page],
  );

  const loadSummary = useCallback(
    async (opts?: { date?: string; branch_id?: number | "" }) => {
      const date = opts?.date ?? dateTo;
      const branchId = opts?.branch_id ?? branchFilter;
      try {
        const overview = await fetchAttendanceOverview({
          date,
          branch_id: branchId,
        });
        setStats(overview.dashboard);
        setShiftsToday(overview.shifts);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Không tải được thống kê.",
        );
      }
    },
    [dateTo, branchFilter],
  );

  useEffect(() => {
    async function boot() {
      try {
        const shiftList = await fetchShifts({ per_page: 50 }).catch(() => ({
          data: [] as Shift[],
        }));
        setShifts(shiftList.data);
        await Promise.all([loadList({ page: 1 }), loadSummary()]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được chấm công.");
      } finally {
        setLoading(false);
      }
    }
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  async function openQuickAttendance() {
    if (!employeesLoaded) {
      setModalLoading(true);
      try {
        const result = await fetchEmployees({ per_page: 100, status: "active" });
        setEmployees(result.data ?? []);
        setEmployeesLoaded(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Không tải được nhân viên.",
        );
        return;
      } finally {
        setModalLoading(false);
      }
    }
    setModalOpen(true);
  }

  return (
    <>
      <div className="lg:hidden">
        {error ? (
          <div className="mx-3.5 mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {error}
          </div>
        ) : null}
        <MobileAttendance
          stats={stats}
          shiftsToday={shiftsToday}
          shifts={shifts}
          rows={rows}
          total={total}
          page={page}
          lastPage={lastPage}
          loading={loading || listLoading}
          branches={branches}
          branchFilter={branchFilter}
          shiftFilter={shiftFilter}
          statusFilter={statusFilter}
          onBranchChange={(id) => {
            setBranchFilter(id);
            void Promise.all([
              loadList({ branch_id: id, page: 1 }),
              loadSummary({ branch_id: id }),
            ]);
          }}
          onShiftChange={(id) => {
            setShiftFilter(id);
            void loadList({ shift_id: id, page: 1 });
          }}
          onStatusChange={(v) => {
            setStatusFilter(v);
            void loadList({ status: v, page: 1 });
          }}
          onPageChange={(p) => {
            void loadList({ page: p });
          }}
          onExport={() => {
            void exportAttendances({
              from: dateFrom,
              to: dateTo,
              branch_id: branchFilter,
            }).catch((err) =>
              setError(
                err instanceof Error ? err.message : "Xuất file thất bại.",
              ),
            );
          }}
          onCheckIn={() => void openQuickAttendance()}
          checkInLoading={modalLoading}
          onView={(row) => setRecordModal({ mode: "view", row })}
          onEdit={(row) => setRecordModal({ mode: "edit", row })}
          onDelete={(row) => {
            if (!row.id && !row.branch_id) {
              setError("Nhân viên chưa được gắn chi nhánh để xoá dòng này.");
              return;
            }
            setPendingDelete(row);
          }}
        />
      </div>
        <main className="hidden flex-1 overflow-y-auto p-5 lg:block lg:p-6">
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
                    from: dateFrom,
                    to: dateTo,
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
                onClick={() => void openQuickAttendance()}
                disabled={modalLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
              >
                {modalLoading ? "Đang tải nhân viên..." : "Check-in / Check-out"}
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
                dateFrom={dateFrom}
                dateTo={dateTo}
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
                loading={loading || listLoading}
                onSearchChange={setSearch}
                onSearchSubmit={() => {
                  setAppliedSearch(search);
                  void loadList({ search, page: 1 });
                }}
                onDateFromChange={(v) => {
                  setDateFrom(v);
                  void loadList({ from: v, page: 1 });
                }}
                onDateToChange={(v) => {
                  setDateTo(v);
                  void Promise.all([
                    loadList({ to: v, page: 1 }),
                    loadSummary({ date: v }),
                  ]);
                }}
                onBranchChange={(v) => {
                  const id = v ? Number(v) : "";
                  setBranchFilter(id);
                  void Promise.all([
                    loadList({ branch_id: id, page: 1 }),
                    loadSummary({ branch_id: id }),
                  ]);
                }}
                onShiftChange={(v) => {
                  const id = v ? Number(v) : "";
                  setShiftFilter(id);
                  void loadList({ shift_id: id, page: 1 });
                }}
                onStatusChange={(v) => {
                  setStatusFilter(v);
                  void loadList({ status: v, page: 1 });
                }}
                onPageChange={(p) => {
                  void loadList({ page: p });
                }}
                onView={(row) => setRecordModal({ mode: "view", row })}
                onEdit={(row) => setRecordModal({ mode: "edit", row })}
                onDelete={(row) => {
                  if (!row.id && !row.branch_id) {
                    setError("Nhân viên chưa được gắn chi nhánh để xoá dòng này.");
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

      {modalOpen ? (
        <QuickAttendanceModal
          open={modalOpen}
          employees={employees}
          branches={branches}
          shifts={shifts}
          date={dateTo}
          defaultBranchId={
            typeof branchFilter === "number"
              ? branchFilter
              : branches[0]?.id
          }
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            showToast("Đã cập nhật chấm công.");
            void Promise.all([loadList(), loadSummary()]);
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
            void Promise.all([loadList(), loadSummary()]);
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
            setDeleting(true);
            const deletingRequest = pendingDelete.id
              ? deleteAttendance(pendingDelete.id)
              : deleteSyntheticAttendance({
                  employee_id: pendingDelete.employee_id,
                  branch_id: pendingDelete.branch_id as number,
                  work_date: pendingDelete.work_date,
                });
            void deletingRequest
              .then(() => {
                setPendingDelete(null);
                showToast("Đã xoá bản ghi chấm công.");
                void Promise.all([loadList(), loadSummary()]);
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
        <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center lg:bottom-6">
          <span className="rounded-full bg-slate-900/85 px-4 py-2 text-sm text-white">
            {toast}
          </span>
        </div>
      )}
    </>
  );
}
