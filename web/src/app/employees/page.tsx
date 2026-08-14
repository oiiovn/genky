"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Download,
  Plus,
  Upload,
} from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { EmployeeFilterPanel, type FilterDraft } from "@/components/employees/EmployeeFilterPanel";
import { EmployeeFormModal } from "@/components/employees/EmployeeFormModal";
import { EmployeeStatsCards } from "@/components/employees/EmployeeStatsCards";
import { EmployeeTable } from "@/components/employees/EmployeeTable";
import { EmployeeViewModal } from "@/components/employees/EmployeeViewModal";
import { InviteLinkModal } from "@/components/employees/InviteLinkModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fetchBranches, fetchDashboard, getAccessToken, me } from "@/lib/api";
import type { Branch } from "@/lib/api";
import {
  deleteEmployee,
  fetchEmployees,
  fetchPositions,
  inviteEmployee,
  type Employee,
  type Position,
} from "@/lib/employees-api";
import type { DashboardData } from "@/types/dashboard";

const emptyFilters: FilterDraft = {
  branch_id: "",
  position_id: "",
  status: "",
  search: "",
};

export default function EmployeesPage() {
  const router = useRouter();
  const [shell, setShell] = useState<DashboardData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [rows, setRows] = useState<Employee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [draft, setDraft] = useState<FilterDraft>(emptyFilters);
  const [applied, setApplied] = useState<FilterDraft>(emptyFilters);
  const [tableSearch, setTableSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [viewing, setViewing] = useState<Employee | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Employee | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [inviteInfo, setInviteInfo] = useState<{
    name: string;
    email: string;
    url: string;
  } | null>(null);
  const [inviteLoadingId, setInviteLoadingId] = useState<number | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    resigned: 0,
    leave: 0,
  });

  const loadList = useCallback(async (filters: FilterDraft, pageNum: number) => {
    setListLoading(true);
    setError(null);
    try {
      const res = await fetchEmployees({
        branch_id: filters.branch_id,
        position_id: filters.position_id,
        status: filters.status || undefined,
        search: filters.search || undefined,
        page: pageNum,
        per_page: 10,
      });
      setRows(res.data);
      setTotal(res.meta.total);
      setPage(res.meta.current_page);
      setLastPage(res.meta.last_page);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được danh sách.");
    } finally {
      setListLoading(false);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const [all, active, resigned, inactive] = await Promise.all([
        fetchEmployees({ per_page: 1 }),
        fetchEmployees({ status: "active", per_page: 1 }),
        fetchEmployees({ status: "resigned", per_page: 1 }),
        fetchEmployees({ status: "inactive", per_page: 1 }),
      ]);
      setStats({
        total: all.meta.total,
        active: active.meta.total,
        resigned: resigned.meta.total,
        leave: inactive.meta.total,
      });
    } catch {
      /* ignore stats errors */
    }
  }, []);

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
        const [dashboard, branchList, positionList] = await Promise.all([
          fetchDashboard(),
          fetchBranches(),
          fetchPositions(),
        ]);
        setShell(dashboard);
        setBranches(branchList);
        setPositions(positionList);
        await Promise.all([loadList(emptyFilters, 1), loadStats()]);
      } catch {
        router.replace("/login");
        return;
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, [router, loadList, loadStats]);

  const headerData = useMemo(() => {
    if (!shell) return null;
    return {
      ...shell,
      greeting: {
        ...shell.greeting,
        message: "Quản lý nhân sự và thông tin nhân viên",
      },
    };
  }, [shell]);

  async function refreshAll() {
    await Promise.all([loadList(applied, page), loadStats()]);
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeletingId(pendingDelete.id);
    setError(null);
    try {
      await deleteEmployee(pendingDelete.id);
      if (viewing?.id === pendingDelete.id) setViewing(null);
      setPendingDelete(null);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xóa được nhân viên.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleInvite(emp: Employee) {
    if (!emp.email) {
      setError("Nhân viên cần có email trước khi mời. Hãy sửa hồ sơ và thêm email.");
      setEditing(emp);
      setModalOpen(true);
      return;
    }
    setInviteLoadingId(emp.id);
    setError(null);
    try {
      const result = await inviteEmployee(emp.id);
      setInviteInfo({
        name: emp.full_name,
        email: result.email,
        url: result.invite_url,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được lời mời.");
    } finally {
      setInviteLoadingId(null);
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
      <Sidebar tenant={shell.tenant} active="Nhân viên" access={shell.access} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          data={headerData}
          subtitle="Quản lý nhân sự và thông tin nhân viên"
        />

        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Nhân viên</h2>
              <p className="text-sm text-slate-500">
                Quản lý hồ sơ, chức vụ và chi nhánh nhân sự
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
              >
                <Upload className="h-4 w-4" />
                Nhập nhân viên
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
              >
                <Download className="h-4 w-4" />
                Xuất Excel
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm"
              >
                <Plus className="h-4 w-4" />
                Thêm nhân viên
                <ChevronDown className="h-4 w-4 opacity-80" />
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </div>
          )}

          <EmployeeStatsCards stats={stats} />

          <div className="mt-5 flex flex-col gap-5 xl:flex-row">
            <div className="min-w-0 flex-1">
              <EmployeeTable
                rows={rows}
                total={total}
                page={page}
                lastPage={lastPage}
                search={tableSearch}
                loading={listLoading}
                onSearchChange={setTableSearch}
                onSearchSubmit={() => {
                  const next = { ...applied, search: tableSearch };
                  setApplied(next);
                  setDraft(next);
                  void loadList(next, 1);
                }}
                onPageChange={(p) => {
                  void loadList(applied, p);
                }}
                onEdit={(emp) => {
                  setViewing(null);
                  setEditing(emp);
                  setModalOpen(true);
                }}
                onView={(emp) => setViewing(emp)}
                onDelete={(emp) => setPendingDelete(emp)}
                onInvite={(emp) => {
                  void handleInvite(emp);
                }}
              />

              <div className="mt-4 flex items-center justify-between rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-violet-50 px-5 py-4">
                <div>
                  <p className="font-semibold text-slate-800">
                    Quản lý nhân viên hiệu quả
                  </p>
                  <p className="text-sm text-slate-500">
                    Thêm nhân viên, gán chi nhánh và chức vụ ngay trên Genky
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setModalOpen(true);
                  }}
                  className="rounded-full bg-indigo-500 p-2 text-white shadow-sm"
                  aria-label="Thêm"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>

            <EmployeeFilterPanel
              draft={draft}
              branches={branches}
              positions={positions}
              onChange={setDraft}
              onApply={() => {
                setApplied(draft);
                setTableSearch(draft.search);
                void loadList(draft, 1);
              }}
              onReset={() => {
                setDraft(emptyFilters);
                setApplied(emptyFilters);
                setTableSearch("");
                void loadList(emptyFilters, 1);
              }}
            />
          </div>
        </main>
      </div>

      {modalOpen && (
        <EmployeeFormModal
          key={editing?.id ?? "new"}
          open={modalOpen}
          editing={editing}
          branches={branches}
          positions={positions}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            void refreshAll();
          }}
        />
      )}

      {viewing && (
        <EmployeeViewModal
          employee={viewing}
          onClose={() => setViewing(null)}
          onEdit={() => {
            setEditing(viewing);
            setViewing(null);
            setModalOpen(true);
          }}
        />
      )}

      {pendingDelete ? (
        <ConfirmDialog
          open
          title="Xóa nhân viên"
          message={`Xóa ${pendingDelete.full_name} (${pendingDelete.employee_code})? Hành động này không hoàn tác.`}
          loading={deletingId !== null}
          onClose={() => {
            if (deletingId === null) setPendingDelete(null);
          }}
          onConfirm={() => void handleDelete()}
        />
      ) : null}

      {inviteInfo && (
        <InviteLinkModal
          open
          employeeName={inviteInfo.name}
          email={inviteInfo.email}
          inviteUrl={inviteInfo.url}
          onClose={() => setInviteInfo(null)}
        />
      )}

      {deletingId !== null && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <span className="rounded-full bg-slate-900/80 px-4 py-2 text-sm text-white">
            Đang xóa nhân viên...
          </span>
        </div>
      )}

      {inviteLoadingId !== null && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center">
          <span className="rounded-full bg-slate-900/80 px-4 py-2 text-sm text-white">
            Đang tạo link mời...
          </span>
        </div>
      )}
    </div>
  );
}
