"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Branch } from "@/lib/api";
import type { Employee } from "@/lib/employees-api";
import type { Shift } from "@/lib/shifts-api";
import { formatDisplayDate } from "@/lib/schedule-utils";

export function AssignShiftModal({
  open,
  employee,
  date,
  branches,
  shifts,
  defaultBranchId,
  saving,
  error,
  onClose,
  onSubmit,
}: {
  open: boolean;
  employee: Employee | null;
  date: string | null;
  branches: Branch[];
  shifts: Shift[];
  defaultBranchId: number | "";
  saving?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (payload: {
    shift_id: number;
    branch_id: number;
    note?: string;
  }) => void;
}) {
  const [shiftId, setShiftId] = useState<number | "">("");
  const [branchId, setBranchId] = useState<number | "">(defaultBranchId);
  const [note, setNote] = useState("");

  if (!open || !employee || !date) return null;

  const empBranches = employee.branches ?? [];
  const branchOptions =
    empBranches.length > 0
      ? branches.filter((b) => empBranches.some((eb) => eb.id === b.id))
      : branches;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Phân ca</h3>
            <p className="text-sm text-slate-500">
              {employee.full_name} · {formatDisplayDate(date)}/{date.slice(0, 4)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Ca làm
            </label>
            <select
              value={shiftId === "" ? "" : String(shiftId)}
              onChange={(e) =>
                setShiftId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
            >
              <option value="">Chọn ca</option>
              {shifts
                .filter((s) => s.status === "active")
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Chi nhánh
            </label>
            <select
              value={branchId === "" ? "" : String(branchId)}
              onChange={(e) =>
                setBranchId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
            >
              <option value="">Chọn chi nhánh</option>
              {branchOptions.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Ghi chú
            </label>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              placeholder="Tuỳ chọn"
            />
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={saving || !shiftId || !branchId}
            onClick={() => {
              if (!shiftId || !branchId) return;
              onSubmit({
                shift_id: shiftId,
                branch_id: branchId,
                note: note.trim() || undefined,
              });
            }}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : "Phân ca"}
          </button>
        </div>
      </div>
    </div>
  );
}
