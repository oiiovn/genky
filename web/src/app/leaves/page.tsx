"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { LeaveFormModal } from "@/components/leaves/LeaveFormModal";
import { LeaveStatsCards } from "@/components/leaves/LeaveStatsCards";
import { LeaveTable } from "@/components/leaves/LeaveTable";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { fetchEmployees, type Employee } from "@/lib/employees-api";
import {
  deleteLeave,
  fetchLeaves,
  reviewLeave,
  type LeaveRequest,
  type LeaveStats,
} from "@/lib/leave-api";

const emptyStats: LeaveStats = {
  total: 0,
  pending: 0,
  approved: 0,
  rejected: 0,
};

export default function LeavesPage() {
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
  const [editing, setEditing] = useState<LeaveRequest | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LeaveRequest | null>(null);
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
      try {
        const empList = await fetchEmployees({
          status: "active",
          per_page: 100,
        }).catch(() => null);
        setEmployees(empList?.data ?? []);
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, []);

  useEffect(() => {
    void loadList();
  }, [loadList]);

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

  async function handleDelete() {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    setError(null);
    try {
      await deleteLeave(pendingDelete.id);
      setPendingDelete(null);
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không xoá được đơn.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
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
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
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
            loading={loading || listLoading}
            busyId={busyId}
            onSearchChange={setSearch}
            onStatusChange={setStatus}
            onTypeChange={setType}
            onApprove={(row) => void review(row.id, "approved")}
            onReject={(row) => void review(row.id, "rejected")}
            onEdit={(row) => {
              setEditing(row);
              setModalOpen(true);
            }}
            onDelete={setPendingDelete}
          />
        </main>

      <LeaveFormModal
        open={modalOpen}
        employees={employees}
        editing={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSaved={() => void loadList()}
      />

      {pendingDelete ? (
        <ConfirmDialog
          open
          title="Xóa đơn nghỉ phép"
          message={`Xóa đơn của ${pendingDelete.full_name ?? "nhân viên"} (${pendingDelete.from} → ${pendingDelete.to})? Hành động này không hoàn tác.`}
          loading={busyId === pendingDelete.id}
          onClose={() => {
            if (busyId === null) setPendingDelete(null);
          }}
          onConfirm={() => void handleDelete()}
        />
      ) : null}
    </>
  );
}
