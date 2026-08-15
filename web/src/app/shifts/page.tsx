"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Download, Plus, Upload } from "lucide-react";
import { useAdminChrome } from "@/components/admin/AdminShell";
import { ShiftDetailPanel } from "@/components/shifts/ShiftDetailPanel";
import { ShiftFormModal } from "@/components/shifts/ShiftFormModal";
import { ShiftStatsCards } from "@/components/shifts/ShiftStatsCards";
import { ShiftTable } from "@/components/shifts/ShiftTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import {
  createShift,
  deleteShift,
  exportShifts,
  fetchShiftSummary,
  fetchShifts,
  importShifts,
  updateShift,
  type Shift,
  type ShiftSummary,
} from "@/lib/shifts-api";

const emptySummary: ShiftSummary = {
  total: 0,
  active: 0,
  active_percent: 0,
  employees_today: 0,
  ongoing_shifts: 0,
  open_slots: 0,
};

export default function ShiftsPage() {
  const { branches } = useAdminChrome();
  const importRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Shift[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [stats, setStats] = useState<ShiftSummary>(emptySummary);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">(
    "",
  );
  const [activeTab, setActiveTab] = useState<
    | "Danh sách ca làm"
    | "Lịch theo tuần"
    | "Lịch theo tháng"
    | "Phân ca tự động"
  >("Danh sách ca làm");
  const [selected, setSelected] = useState<Shift | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Shift | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadList = useCallback(
    async (opts?: {
      search?: string;
      status?: "" | "active" | "inactive";
      page?: number;
    }) => {
      setListLoading(true);
      setError(null);
      try {
        const res = await fetchShifts({
          search: opts?.search ?? appliedSearch,
          status: (opts?.status ?? statusFilter) || undefined,
          page: opts?.page ?? page,
          per_page: 10,
        });
        const data = Array.isArray(res.data) ? res.data : [];
        const meta = res.meta ?? {
          current_page: 1,
          last_page: 1,
          per_page: 10,
          total: data.length,
        };
        setRows(data);
        setTotal(meta.total ?? data.length);
        setPage(meta.current_page ?? 1);
        setLastPage(meta.last_page ?? 1);
        setSelected((prev) => {
          if (!prev) return data[0] ?? null;
          return data.find((s) => s.id === prev.id) ?? data[0] ?? null;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không tải được ca làm.");
      } finally {
        setListLoading(false);
      }
    },
    [appliedSearch, statusFilter, page],
  );

  const loadStats = useCallback(async () => {
    try {
      setStats(await fetchShiftSummary());
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    async function boot() {
      try {
        await Promise.all([
          loadList({ search: "", status: "", page: 1 }),
          loadStats(),
        ]);
      } finally {
        setLoading(false);
      }
    }
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refreshAll() {
    await Promise.all([loadList(), loadStats()]);
  }

  async function handleDeactivate(shift: Shift) {
    setDeactivating(true);
    setError(null);
    try {
      const updated = await updateShift(shift.id, { status: "inactive" });
      setSelected(updated);
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể ngừng ca.");
    } finally {
      setDeactivating(false);
    }
  }

  async function handleDuplicate(shift: Shift) {
    setError(null);
    try {
      await createShift({
        name: `${shift.name} (copy)`,
        code: undefined,
        start_time: shift.start_time,
        end_time: shift.end_time,
        break_time: shift.break_minutes,
        color: shift.color,
        description: shift.description,
        status: "active",
        branch_id: shift.branch_id,
        icon: shift.icon,
      });
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể sao chép ca.");
    }
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteShift(pendingDelete.id);
      if (selected?.id === pendingDelete.id) {
        setSelected(null);
      }
      setPendingDelete(null);
      await refreshAll();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Không thể xóa ca làm.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleImport(file: File) {
    setError(null);
    try {
      const result = await importShifts(file);
      await refreshAll();
      if (result.count === 0) {
        setError("Không import được dòng nào. Kiểm tra định dạng CSV.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import thất bại.");
    }
  }

  async function handleExport() {
    setError(null);
    try {
      await exportShifts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xuất file thất bại.");
    }
  }

  return (
    <>
        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Ca làm</h2>
              <p className="text-sm text-slate-500">
                Quản lý, tạo và phân ca làm việc
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={importRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImport(file);
                  e.target.value = "";
                }}
              />
              <button
                type="button"
                onClick={() => importRef.current?.click()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600"
              >
                <Upload className="h-4 w-4" />
                Import ca
              </button>
              <button
                type="button"
                onClick={() => void handleExport()}
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
                Thêm ca mới
                <ChevronDown className="h-4 w-4 opacity-80" />
              </button>
            </div>
          </div>

          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </div>
          )}

          <ShiftStatsCards stats={stats} />

          <div className="mt-5 flex flex-col gap-5 xl:flex-row">
            <div className="min-w-0 flex-1">
              <ShiftTable
                rows={rows}
                total={total}
                page={page}
                lastPage={lastPage}
                selectedId={selected?.id ?? null}
                search={search}
                statusFilter={statusFilter}
                activeTab={activeTab}
                loading={loading || listLoading}
                onSearchChange={setSearch}
                onSearchSubmit={() => {
                  setAppliedSearch(search);
                  void loadList({ search, page: 1 });
                }}
                onStatusFilterChange={(v) => {
                  setStatusFilter(v);
                  void loadList({ status: v, page: 1 });
                }}
                onTabChange={setActiveTab}
                onSelect={setSelected}
                onEdit={(shift) => {
                  setEditing(shift);
                  setModalOpen(true);
                }}
                onDuplicate={(shift) => {
                  void handleDuplicate(shift);
                }}
                onDelete={setPendingDelete}
                onPageChange={(p) => {
                  void loadList({ page: p });
                }}
              />
            </div>

            <ShiftDetailPanel
              shift={selected}
              onClose={() => setSelected(null)}
              onEdit={(shift) => {
                setEditing(shift);
                setModalOpen(true);
              }}
              onDeactivate={(shift) => {
                void handleDeactivate(shift);
              }}
              deactivating={deactivating}
            />
          </div>
        </main>

      {modalOpen && (
        <ShiftFormModal
          key={editing?.id ?? "new"}
          open={modalOpen}
          editing={editing}
          branches={branches}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={(shift) => {
            setSelected(shift);
            void refreshAll();
          }}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Xóa ca làm"
        message={
          pendingDelete
            ? `Xóa ca “${pendingDelete.name}”? Ca đang có phân công sẽ không thể xóa.`
            : ""
        }
        loading={deleting}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
