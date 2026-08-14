"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Branch } from "@/lib/api";
import {
  createShift,
  updateShift,
  type Shift,
} from "@/lib/shifts-api";

const COLORS = [
  "#3BB2F6",
  "#F59E0B",
  "#8B5CF6",
  "#10B981",
  "#06B6D4",
  "#64748B",
  "#EF4444",
  "#EC4899",
];

export function ShiftFormModal({
  open,
  onClose,
  onSaved,
  branches,
  editing,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (shift: Shift) => void;
  branches: Branch[];
  editing?: Shift | null;
}) {
  const [name, setName] = useState(editing?.name ?? "");
  const [code, setCode] = useState(editing?.code ?? "");
  const [startTime, setStartTime] = useState(editing?.start_time ?? "08:00");
  const [endTime, setEndTime] = useState(editing?.end_time ?? "16:00");
  const [breakMinutes, setBreakMinutes] = useState(
    String(editing?.break_minutes ?? 60),
  );
  const [color, setColor] = useState(editing?.color ?? "#3BB2F6");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [status, setStatus] = useState(editing?.status ?? "active");
  const [branchId, setBranchId] = useState<number | "">(
    editing?.branch_id ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        code: code.trim() || undefined,
        start_time: startTime,
        end_time: endTime,
        break_time: Number(breakMinutes) || 0,
        color,
        description: description.trim() || null,
        status,
        branch_id: branchId ? Number(branchId) : null,
      };
      const saved = editing
        ? await updateShift(editing.id, payload)
        : await createShift(payload);
      onSaved(saved);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">
            {editing ? "Sửa ca làm" : "Thêm ca mới"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Đóng"
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
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Tên ca
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                placeholder="Ca sáng"
              />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Mã ca
              </label>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                placeholder="CS"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Giờ bắt đầu
              </label>
              <input
                required
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Giờ kết thúc
              </label>
              <input
                required
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Giờ nghỉ (phút)
              </label>
              <input
                type="number"
                min={0}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Trạng thái
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              >
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Không hoạt động</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Chi nhánh (tuỳ chọn)
            </label>
            <select
              value={branchId}
              onChange={(e) =>
                setBranchId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            >
              <option value="">Toàn tổ chức</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Màu hiển thị
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="h-8 w-8 rounded-full border-2"
                  style={{
                    backgroundColor: c,
                    borderColor: color === c ? "#312e81" : "transparent",
                  }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Mô tả
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Đang lưu..." : editing ? "Cập nhật" : "Tạo ca"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
