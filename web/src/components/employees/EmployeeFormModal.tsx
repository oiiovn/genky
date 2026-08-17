"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Branch } from "@/lib/api";
import type { Employee, Position } from "@/lib/employees-api";
import { createEmployee, updateEmployee } from "@/lib/employees-api";

export function EmployeeFormModal({
  open,
  onClose,
  onSaved,
  branches,
  positions,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  branches: Branch[];
  positions: Position[];
  editing?: Employee | null;
}) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [positionId, setPositionId] = useState<number | "">("");
  const [branchId, setBranchId] = useState<number | "">("");
  const [status, setStatus] = useState("active");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [payFromShiftStart, setPayFromShiftStart] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFullName(editing?.full_name ?? "");
    setPhone(editing?.phone ?? "");
    setEmail(editing?.email ?? "");
    setPositionId(editing?.position?.id ?? "");
    setBranchId(
      editing?.branches.find((b) => b.is_primary)?.id ??
        editing?.branches[0]?.id ??
        branches[0]?.id ??
        "",
    );
    setStatus(editing?.status ?? "active");
    setSalaryAmount(
      editing?.salary_amount ? String(editing.salary_amount) : "",
    );
    setPayFromShiftStart(Boolean(editing?.pay_from_shift_start));
    setError(null);
  }, [open, editing, branches]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = {
        full_name: fullName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        position_id: positionId ? Number(positionId) : null,
        branch_ids: branchId ? [Number(branchId)] : [],
        primary_branch_id: branchId ? Number(branchId) : undefined,
        status,
        salary_type: "hourly" as const,
        salary_amount: salaryAmount ? Number(salaryAmount) : 0,
        pay_from_shift_start: payFromShiftStart,
      };

      if (editing) {
        await updateEmployee(editing.id, payload);
      } else {
        await createEmployee(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">
            {editing ? "Sửa nhân viên" : "Thêm nhân viên"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Họ và tên
            </label>
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              placeholder="Nguyễn Văn An"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Số điện thoại
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Email{" "}
                <span className="font-normal text-slate-400">
                  (cần để mời tài khoản)
                </span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Chức vụ
              </label>
              <select
                value={positionId}
                onChange={(e) =>
                  setPositionId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              >
                <option value="">Chọn chức vụ</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Chi nhánh
              </label>
              <select
                required
                value={branchId}
                onChange={(e) =>
                  setBranchId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              >
                <option value="">Chọn chi nhánh</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Trạng thái
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
              >
                <option value="active">Đang làm việc</option>
                <option value="inactive">Tạm nghỉ</option>
                <option value="resigned">Nghỉ việc</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Lương / giờ
              </label>
              <input
                type="number"
                min={0}
                value={salaryAmount}
                onChange={(e) => setSalaryAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                placeholder="25000"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <p className="min-w-0 flex-1 text-sm font-medium text-slate-700">
              Tính lương theo ca
            </p>
            <button
              type="button"
              role="switch"
              aria-checked={payFromShiftStart}
              onClick={() => setPayFromShiftStart((v) => !v)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                payFromShiftStart ? "bg-emerald-500" : "bg-slate-200"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                  payFromShiftStart ? "left-[22px]" : "left-0.5"
                }`}
              />
            </button>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Đang lưu..." : editing ? "Cập nhật" : "Thêm nhân viên"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
