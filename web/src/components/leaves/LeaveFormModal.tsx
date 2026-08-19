"use client";

import { FormEvent, useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Employee } from "@/lib/employees-api";
import {
  countLeaveDays,
  createLeave,
  leaveTypeLabels,
  updateLeave,
  type LeaveRequest,
  type LeaveType,
} from "@/lib/leave-api";
import { todayIso } from "@/lib/timezone";

export function LeaveFormModal({
  open,
  employees,
  editing = null,
  onClose,
  onSaved,
}: {
  open: boolean;
  employees: Employee[];
  editing?: LeaveRequest | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [employeeId, setEmployeeId] = useState<number | "">("");
  const [type, setType] = useState<LeaveType>("annual");
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmployeeId(editing?.employee_id ?? "");
    setType((editing?.type as LeaveType) || "annual");
    setFrom(editing?.from ?? todayIso());
    setTo(editing?.to ?? todayIso());
    setReason(editing?.reason ?? "");
    setError(null);
  }, [open, editing]);

  if (!open) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!employeeId) {
      setError("Chọn nhân viên.");
      return;
    }
    const days = countLeaveDays(from, to);
    if (days <= 0) {
      setError("Khoảng ngày không hợp lệ.");
      return;
    }
    if (!reason.trim()) {
      setError("Nhập lý do nghỉ phép.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      employee_id: employeeId,
      type,
      from,
      to,
      reason: reason.trim(),
    };
    try {
      if (editing) {
        await updateLeave(editing.id, payload);
      } else {
        await createLeave(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : editing
            ? "Không cập nhật được đơn."
            : "Không tạo được đơn.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4">
      <form
        onSubmit={(e) => void onSubmit(e)}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">
              {editing ? "Sửa đơn nghỉ phép" : "Tạo đơn nghỉ phép"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {editing
                ? "Cập nhật loại nghỉ, thời gian hoặc lý do."
                : "Đơn tạo bởi chủ quán sẽ được duyệt ngay."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? (
          <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {error}
          </p>
        ) : null}

        <div className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            Nhân viên
            <select
              value={employeeId}
              onChange={(e) =>
                setEmployeeId(e.target.value ? Number(e.target.value) : "")
              }
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800"
            >
              <option value="">Chọn nhân viên</option>
              {editing &&
              !employees.some((emp) => emp.id === editing.employee_id) ? (
                <option value={editing.employee_id}>
                  {editing.full_name} · {editing.employee_code}
                </option>
              ) : null}
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name} · {emp.employee_code}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Loại nghỉ
            <select
              value={type}
              onChange={(e) => setType(e.target.value as LeaveType)}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800"
            >
              {(Object.keys(leaveTypeLabels) as LeaveType[]).map((k) => (
                <option key={k} value={k}>
                  {leaveTypeLabels[k]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-slate-700">
              Từ ngày
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Đến ngày
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
              />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">
            Lý do
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving
              ? "Đang lưu..."
              : editing
                ? "Lưu thay đổi"
                : "Tạo và duyệt"}
          </button>
        </div>
      </form>
    </div>
  );
}
