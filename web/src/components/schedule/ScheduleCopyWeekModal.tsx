"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { formatRangeLabel } from "@/lib/schedule-utils";
import { copyWeekScheduleAssignments } from "@/lib/schedule-api";
import { todayIso } from "@/lib/timezone";

export function ScheduleCopyWeekModal({
  open,
  sourceFrom,
  sourceTo,
  defaultTargetFrom,
  branchId,
  onClose,
  onDone,
}: {
  open: boolean;
  sourceFrom: string;
  sourceTo: string;
  defaultTargetFrom: string;
  branchId: number | "";
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [targetFrom, setTargetFrom] = useState(defaultTargetFrom);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTargetFrom(defaultTargetFrom);
    setError(null);
  }, [open, defaultTargetFrom]);

  const targetTo = useMemo(() => {
    const start = new Date(`${sourceFrom}T12:00:00`);
    const end = new Date(`${sourceTo}T12:00:00`);
    const targetStart = new Date(`${targetFrom}T12:00:00`);
    const spanDays = Math.round(
      (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000),
    );
    targetStart.setDate(targetStart.getDate() + spanDays);
    const y = targetStart.getFullYear();
    const m = String(targetStart.getMonth() + 1).padStart(2, "0");
    const d = String(targetStart.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, [sourceFrom, sourceTo, targetFrom]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (targetFrom < todayIso()) {
      setError("Tuần đích phải từ hôm nay trở đi.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await copyWeekScheduleAssignments({
        source_from: sourceFrom,
        source_to: sourceTo,
        target_from: targetFrom,
        ...(branchId ? { branch_id: Number(branchId) } : {}),
      });
      onDone(
        `Đã sao chép ${result.created} ca` +
          (result.skipped > 0 ? `, bỏ qua ${result.skipped} ca trùng/lỗi` : ""),
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sao chép thất bại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              Sao chép lịch tuần
            </h3>
            <p className="text-sm text-slate-500">
              Nguồn: {formatRangeLabel(sourceFrom, sourceTo)}
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

        {error ? (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Bắt đầu tuần đích
            </label>
            <input
              type="date"
              required
              min={todayIso()}
              value={targetFrom}
              onChange={(e) => setTargetFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
            />
            <p className="mt-1 text-xs text-slate-400">
              Đích: {formatRangeLabel(targetFrom, targetTo)}
            </p>
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
              className="flex-1 rounded-xl bg-indigo-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {loading ? "Đang sao chép..." : "Sao chép"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
