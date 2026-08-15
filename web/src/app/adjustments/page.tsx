"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Plus,
  Settings2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useAdminChrome } from "@/components/admin/AdminShell";
import { Header } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { AdjustmentFormModal } from "@/components/adjustments/AdjustmentFormModal";
import { AdjustmentStatsCards } from "@/components/adjustments/AdjustmentStatsCards";
import {
  AdjustmentFilters,
  AdjustmentRecentTables,
  type AdjustmentTab,
} from "@/components/adjustments/AdjustmentTables";
import { fetchEmployees, type Employee } from "@/lib/employees-api";
import {
  computeAdjustmentStats,
  formatDate,
  monthBounds,
  type AdjustmentRecord,
  type AdjustmentStats,
  type AdjustmentType,
} from "@/lib/adjustments";
import {
  createAdjustment,
  fetchAdjustments,
  updateAdjustment,
} from "@/lib/adjustments-api";
import { currentMonth, currentYear } from "@/lib/timezone";

const AdjustmentSidePanel = dynamic(
  () =>
    import("@/components/adjustments/AdjustmentSidePanel").then(
      (mod) => mod.AdjustmentSidePanel,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="h-[360px] w-full max-w-sm animate-pulse rounded-2xl bg-white" />
    ),
  },
);

function currentMonthParts() {
  return { year: currentYear(), month: currentMonth() };
}

export default function AdjustmentsPage() {
  const { shell, branches, headerData } = useAdminChrome(
    "Quản lý thưởng và xử phạt nhân viên",
  );
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [records, setRecords] = useState<AdjustmentRecord[]>([]);
  const [monthStats, setMonthStats] = useState<AdjustmentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const initial = currentMonthParts();
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [tab, setTab] = useState<AdjustmentTab>("overview");
  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState<number | "">("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"" | AdjustmentType>("");
  const [rewardPage, setRewardPage] = useState(1);
  const [penaltyPage, setPenaltyPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdjustmentRecord | null>(null);

  const bounds = useMemo(() => monthBounds(year, month), [year, month]);
  const rangeLabel = `${formatDate(bounds.from)} - ${formatDate(bounds.to)}`;

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  useEffect(() => {
    async function boot() {
      try {
        const empList = await fetchEmployees({
          status: "active",
          per_page: 100,
        }).catch(() => ({ data: [] as Employee[] }));
        setEmployees(empList.data);
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, []);

  const loadRecords = useCallback(async (y: number, m: number) => {
    try {
      const res = await fetchAdjustments({ year: y, month: m });
      setRecords(res.data);
      setMonthStats(res.stats);
    } catch (err) {
      setRecords([]);
      setMonthStats(null);
      showToast(err instanceof Error ? err.message : "Không tải được thưởng / phạt.");
    }
  }, [showToast]);

  useEffect(() => {
    void loadRecords(year, month);
    setRewardPage(1);
    setPenaltyPage(1);
  }, [year, month, loadRecords]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    for (const e of employees) {
      if (e.position?.name) set.add(e.position.name);
    }
    return Array.from(set).sort();
  }, [employees]);

  const filtered = useMemo(() => {
    let list = records;
    if (branchFilter) {
      list = list.filter((r) => r.branch_ids.includes(branchFilter));
    }
    if (departmentFilter) {
      list = list.filter((r) => r.department === departmentFilter);
    }
    if (typeFilter) {
      list = list.filter((r) => r.type === typeFilter);
    }
    if (tab === "rewards") list = list.filter((r) => r.type === "reward");
    if (tab === "penalties") list = list.filter((r) => r.type === "penalty");
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.full_name.toLowerCase().includes(q) ||
          r.employee_code.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q),
      );
    }
    return list;
  }, [records, branchFilter, departmentFilter, typeFilter, tab, search]);

  const stats = useMemo(() => {
    const filteredStats = computeAdjustmentStats(filtered);
    if (!monthStats) return filteredStats;
    const hasExtraFilter = Boolean(
      branchFilter || departmentFilter || typeFilter || search.trim(),
    );
    if (hasExtraFilter) {
      return {
        ...filteredStats,
        reward_delta: monthStats.reward_delta,
        penalty_delta: monthStats.penalty_delta,
        recorded_delta: monthStats.recorded_delta,
      };
    }
    return monthStats;
  }, [
    filtered,
    monthStats,
    branchFilter,
    departmentFilter,
    typeFilter,
    search,
  ]);

  const rewardsAll = filtered.filter((r) => r.type === "reward");
  const penaltiesAll = filtered.filter((r) => r.type === "penalty");
  const perPage = 5;
  const lastRewardPage = Math.max(1, Math.ceil(rewardsAll.length / perPage));
  const lastPenaltyPage = Math.max(1, Math.ceil(penaltiesAll.length / perPage));
  const rewardRows = rewardsAll.slice(
    (Math.min(rewardPage, lastRewardPage) - 1) * perPage,
    Math.min(rewardPage, lastRewardPage) * perPage,
  );
  const penaltyRows = penaltiesAll.slice(
    (Math.min(penaltyPage, lastPenaltyPage) - 1) * perPage,
    Math.min(penaltyPage, lastPenaltyPage) * perPage,
  );

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
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
      <Sidebar tenant={shell.tenant} active="Thưởng / Phạt" access={shell.access} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          data={headerData}
          subtitle="Quản lý thưởng và xử phạt nhân viên"
        />

        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Thưởng / Phạt</h2>
              <p className="text-sm text-slate-500">
                Theo dõi thưởng, phạt và phân bổ theo nhân viên
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                <button
                  type="button"
                  onClick={() => shiftMonth(-1)}
                  className="px-2.5 py-2 text-slate-500 hover:bg-slate-50"
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
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => showToast("Cài đặt sắp có")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
              >
                <Settings2 className="h-4 w-4" />
                Cài đặt
              </button>
              <button
                type="button"
                onClick={() => showToast("Xuất Excel sắp có")}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
              >
                <Download className="h-4 w-4 text-emerald-500" />
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
                Thêm thưởng / phạt
                <ChevronDown className="h-4 w-4 opacity-80" />
              </button>
            </div>
          </div>

          <AdjustmentFilters
            tab={tab}
            rangeLabel={rangeLabel}
            branchFilter={branchFilter}
            departmentFilter={departmentFilter}
            typeFilter={typeFilter}
            search={search}
            branches={branches}
            departments={departments}
            onTabChange={(t) => {
              setTab(t);
              setRewardPage(1);
              setPenaltyPage(1);
            }}
            onBranchChange={(v) => {
              setBranchFilter(v);
              setRewardPage(1);
              setPenaltyPage(1);
            }}
            onDepartmentChange={(v) => {
              setDepartmentFilter(v);
              setRewardPage(1);
              setPenaltyPage(1);
            }}
            onTypeChange={(v) => {
              setTypeFilter(v);
              setRewardPage(1);
              setPenaltyPage(1);
            }}
            onSearchChange={(v) => {
              setSearch(v);
              setRewardPage(1);
              setPenaltyPage(1);
            }}
          />

          {tab === "overview" || tab === "rewards" || tab === "penalties" ? (
            <>
              <div className="mt-4">
                <AdjustmentStatsCards stats={stats} />
              </div>

              <div className="mt-5 flex flex-col gap-5 xl:flex-row">
                <div className="min-w-0 flex-1">
                  {tab === "overview" ? (
                    <AdjustmentRecentTables
                      rewards={rewardRows}
                      penalties={penaltyRows}
                      rewardTotal={rewardsAll.length}
                      penaltyTotal={penaltiesAll.length}
                      rewardPage={Math.min(rewardPage, lastRewardPage)}
                      penaltyPage={Math.min(penaltyPage, lastPenaltyPage)}
                      lastRewardPage={lastRewardPage}
                      lastPenaltyPage={lastPenaltyPage}
                      onRewardPage={setRewardPage}
                      onPenaltyPage={setPenaltyPage}
                      onEdit={(row) => {
                        setEditing(row);
                        setModalOpen(true);
                      }}
                    />
                  ) : (
                    <AdjustmentRecentTables
                      rewards={tab === "rewards" ? rewardRows : []}
                      penalties={tab === "penalties" ? penaltyRows : []}
                      rewardTotal={tab === "rewards" ? rewardsAll.length : 0}
                      penaltyTotal={
                        tab === "penalties" ? penaltiesAll.length : 0
                      }
                      rewardPage={Math.min(rewardPage, lastRewardPage)}
                      penaltyPage={Math.min(penaltyPage, lastPenaltyPage)}
                      lastRewardPage={lastRewardPage}
                      lastPenaltyPage={lastPenaltyPage}
                      onRewardPage={setRewardPage}
                      onPenaltyPage={setPenaltyPage}
                      onEdit={(row) => {
                        setEditing(row);
                        setModalOpen(true);
                      }}
                    />
                  )}
                </div>
                <AdjustmentSidePanel records={filtered} />
              </div>
            </>
          ) : (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
              <p className="text-sm font-medium text-slate-700">
                Tab này đang được hoàn thiện
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Hiện dùng Tổng quan / Danh sách thưởng / Danh sách phạt.
              </p>
            </div>
          )}
        </main>
      </div>

      <AdjustmentFormModal
        key={editing?.id ?? "new"}
        open={modalOpen}
        employees={employees}
        editing={editing}
        createdBy={shell.greeting.name || "Admin"}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={(payload) => {
          void (async () => {
            const body = {
              employee_id: payload.employee_id,
              type: payload.type,
              category: payload.category,
              reason: payload.reason,
              amount: payload.amount,
              date: payload.date,
            };
            try {
              if (payload.id) {
                await updateAdjustment(payload.id, body);
                showToast("Đã cập nhật bản ghi");
              } else {
                await createAdjustment(body);
                showToast("Đã thêm bản ghi");
              }
              setModalOpen(false);
              setEditing(null);
              await loadRecords(year, month);
            } catch (err) {
              showToast(
                err instanceof Error ? err.message : "Không lưu được bản ghi.",
              );
            }
          })();
        }}
      />

      {toast ? (
        <div className="fixed right-5 bottom-5 z-50 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
