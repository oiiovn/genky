"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Employee } from "@/lib/employees-api";
import {
  CATEGORY_LABELS,
  type AdjustmentCategory,
  type AdjustmentRecord,
  type AdjustmentType,
} from "@/lib/adjustments";

import { todayIso } from "@/lib/timezone";

export function AdjustmentFormModal({
  open,
  employees,
  editing,
  createdBy,
  onClose,
  onSave,
}: {
  open: boolean;
  employees: Employee[];
  editing: AdjustmentRecord | null;
  createdBy: string;
  onClose: () => void;
  onSave: (payload: Omit<AdjustmentRecord, "id"> & { id?: number }) => void;
}) {
  const [type, setType] = useState<AdjustmentType>(editing?.type ?? "reward");
  const [employeeId, setEmployeeId] = useState<number | "">(
    editing?.employee_id ?? "",
  );
  const [category, setCategory] = useState<AdjustmentCategory>(
    editing?.category ?? "personal_reward",
  );
  const [reason, setReason] = useState(editing?.reason ?? "");
  const [amount, setAmount] = useState(editing?.amount ? String(editing.amount) : "");
  const [date, setDate] = useState(editing?.date ?? todayIso());

  if (!open) return null;

  const categories = (
    Object.keys(CATEGORY_LABELS) as AdjustmentCategory[]
  ).filter((c) =>
    type === "reward"
      ? c.includes("reward")
      : c.includes("penalty") || c === "discipline" || c === "late",
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-lg font-semibold text-slate-800">
            {editing ? "Sửa thưởng / phạt" : "Thêm thưởng / phạt"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(["reward", "penalty"] as AdjustmentType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setType(t);
                  setCategory(
                    t === "reward" ? "personal_reward" : "discipline",
                  );
                }}
                className={
                  type === t
                    ? "rounded-xl bg-indigo-500 py-2 text-sm font-semibold text-white"
                    : "rounded-xl border border-slate-200 py-2 text-sm font-medium text-slate-600"
                }
              >
                {t === "reward" ? "Thưởng" : "Phạt"}
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nhân viên
            </label>
            <select
              value={employeeId === "" ? "" : String(employeeId)}
              onChange={(e) =>
                setEmployeeId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
            >
              <option value="">Chọn nhân viên</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.full_name} ({e.employee_code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Loại lý do
            </label>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as AdjustmentCategory)
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Lý do
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              placeholder="Nhập lý do"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Số tiền
              </label>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Ngày
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          </div>
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
            disabled={!employeeId || !reason.trim() || !amount}
            onClick={() => {
              const emp = employees.find((e) => e.id === employeeId);
              if (!emp) return;
              onSave({
                id: editing?.id,
                employee_id: emp.id,
                employee_code: emp.employee_code,
                full_name: emp.full_name,
                avatar: emp.avatar,
                department: emp.position?.name ?? "—",
                type,
                category,
                reason: reason.trim(),
                amount: Number(amount),
                date,
                created_by: editing?.created_by ?? createdBy,
                branch_ids: emp.branches.map((b) => b.id),
              });
            }}
            className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Lưu
          </button>
        </div>
      </div>
    </div>
  );
}
