"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Settings2,
  Wallet,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useAdminChrome } from "@/components/admin/AdminShell";
import { Header } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { PayrollStatsCards } from "@/components/payroll/PayrollStatsCards";
import {
  PayrollTable,
  type PayrollMainTab,
} from "@/components/payroll/PayrollTable";
import { PayrollPayModal } from "@/components/payroll/PayrollPayModal";
import {
  exportPayrolls,
  fetchPayrollPayments,
  fetchPayrolls,
  monthBounds,
  type DepartmentCost,
  type PayrollPaymentGroup,
  type PayrollRow,
  type PayrollStats,
  type PayrollStatus,
} from "@/lib/payroll-api";
import { currentMonth, currentYear } from "@/lib/timezone";

const PayrollSidePanel = dynamic(
  () =>
    import("@/components/payroll/PayrollSidePanel").then(
      (mod) => mod.PayrollSidePanel,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] w-full max-w-sm animate-pulse rounded-2xl bg-white" />
    ),
  },
);

const emptyStats: PayrollStats = {
  employees: 0,
  fund: 0,
  income: 0,
  deductions: 0,
  paid_percent: 0,
  fund_delta: 0,
  income_delta: 0,
  deductions_delta: 0,
};

export default function PayrollPage() {
  const { shell, branches, headerData } = useAdminChrome(
    "Quản lý lương và thanh toán cho nhân viên",
  );
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [mainTab, setMainTab] = useState<PayrollMainTab>("sheet");
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<number | "">("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | PayrollStatus>("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [stats, setStats] = useState<PayrollStats>(emptyStats);
  const [departments, setDepartments] = useState<string[]>([]);
  const [deptCosts, setDeptCosts] = useState<DepartmentCost[]>([]);
  const [reloadKey, setReloadKey] = useState(0);

  const [paymentGroups, setPaymentGroups] = useState<PayrollPaymentGroup[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLastPage, setHistoryLastPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyYearFilter, setHistoryYearFilter] = useState<number | "">("");
  const [historyMonthFilter, setHistoryMonthFilter] = useState<number | "">("");
  const [historySearch, setHistorySearch] = useState("");
  const [historyReloadKey, setHistoryReloadKey] = useState(0);
  const [payOpen, setPayOpen] = useState(false);
  const [payEmployeeId, setPayEmployeeId] = useState<number | null>(null);

  const bounds = useMemo(() => monthBounds(year, month), [year, month]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const loadList = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const res = await fetchPayrolls({
        year,
        month,
        branch_id: branchFilter,
        department: departmentFilter || undefined,
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
      setDeptCosts(res.department_costs ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tải được bảng lương.",
      );
    } finally {
      setListLoading(false);
    }
  }, [
    year,
    month,
    branchFilter,
    departmentFilter,
    statusFilter,
    search,
    page,
    perPage,
  ]);

  useEffect(() => {
    void loadList();
  }, [loadList, reloadKey]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const res = await fetchPayrollPayments({
        year: historyYearFilter,
        month: historyMonthFilter,
        branch_id: branchFilter,
        search: historySearch.trim() || undefined,
        page: historyPage,
        per_page: 20,
      });
      setPaymentGroups(res.data ?? []);
      setHistoryTotal(res.meta?.total ?? 0);
      setHistoryPage(res.meta?.current_page ?? 1);
      setHistoryLastPage(res.meta?.last_page ?? 1);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không tải được lịch sử lương.",
      );
    } finally {
      setHistoryLoading(false);
    }
  }, [
    historyYearFilter,
    historyMonthFilter,
    branchFilter,
    historySearch,
    historyPage,
  ]);

  useEffect(() => {
    if (mainTab !== "history") return;
    void loadHistory();
  }, [mainTab, loadHistory, historyReloadKey]);

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setPage(1);
    setSelectedIds([]);
  }

  function openPay(employeeId?: number) {
    setPayEmployeeId(employeeId ?? null);
    setPayOpen(true);
  }

  return (
    <div className="flex min-h-screen bg-[#F3F4F6]">
      <Sidebar tenant={shell.tenant} active="Lương" access={shell.access} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          data={headerData}
          subtitle="Quản lý lương và thanh toán cho nhân viên"
        />

        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Lương</h2>
              <p className="text-sm text-slate-500">
                Tính lương, duyệt và theo dõi thanh toán theo tháng
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
                onClick={() => showToast("Cài đặt lương sắp có")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
              >
                <Settings2 className="h-4 w-4" />
                Cài đặt lương
              </button>
              <button
                type="button"
                onClick={() => {
                  void exportPayrolls({
                    year,
                    month,
                    branch_id: branchFilter,
                    department: departmentFilter || undefined,
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
                onClick={() => openPay()}
                className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600"
              >
                <Wallet className="h-4 w-4" />
                Thanh toán lương
              </button>
            </div>
          </div>

          <PayrollStatsCards stats={stats} />

          {error ? (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-5 xl:flex-row">
            <div className="min-w-0 flex-1">
              <PayrollTable
                rows={rows}
                total={total}
                page={page}
                lastPage={lastPage}
                perPage={perPage}
                selectedIds={selectedIds}
                loading={listLoading}
                mainTab={mainTab}
                search={search}
                branchFilter={branchFilter}
                departmentFilter={departmentFilter}
                statusFilter={statusFilter}
                monthLabel={bounds.label}
                branches={branches}
                departments={departments}
                paymentGroups={paymentGroups}
                historyTotal={historyTotal}
                historyPage={historyPage}
                historyLastPage={historyLastPage}
                historyLoading={historyLoading}
                historyYearFilter={historyYearFilter}
                historyMonthFilter={historyMonthFilter}
                historySearch={historySearch}
                onMainTabChange={setMainTab}
                onSearchChange={(v) => {
                  setSearch(v);
                  setPage(1);
                }}
                onBranchChange={(v) => {
                  setBranchFilter(v);
                  setPage(1);
                  setHistoryPage(1);
                }}
                onDepartmentChange={(v) => {
                  setDepartmentFilter(v);
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
                onPayRow={(id) => openPay(id)}
                onHistoryYearChange={(v) => {
                  setHistoryYearFilter(v);
                  setHistoryPage(1);
                }}
                onHistoryMonthChange={(v) => {
                  setHistoryMonthFilter(v);
                  setHistoryPage(1);
                }}
                onHistorySearchChange={(v) => {
                  setHistorySearch(v);
                  setHistoryPage(1);
                }}
                onHistoryPageChange={setHistoryPage}
              />
            </div>

            <PayrollSidePanel
              stats={stats}
              rows={rows}
              departments={deptCosts}
            />
          </div>
        </main>
      </div>

      {payOpen ? (
        <PayrollPayModal
          open={payOpen}
          year={year}
          month={month}
          monthLabel={bounds.label}
          defaultEmployeeId={payEmployeeId}
          onClose={() => setPayOpen(false)}
          onPaid={(msg) => {
            showToast(msg);
            setReloadKey((k) => k + 1);
            setHistoryReloadKey((k) => k + 1);
          }}
        />
      ) : null}

      {toast ? (
        <div className="fixed right-5 bottom-5 z-50 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
