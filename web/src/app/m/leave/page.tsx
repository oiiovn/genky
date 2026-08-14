"use client";

import { FormEvent, useEffect, useState } from "react";
import clsx from "clsx";
import { useStaff } from "@/components/staff/StaffShell";
import {
  cancelLeave,
  countLeaveDays,
  createLeave,
  fetchLeaves,
  leaveStatusLabels,
  leaveTypeLabels,
  type LeaveRequest,
  type LeaveType,
} from "@/lib/leave-api";
import { todayIso } from "@/lib/timezone";

const statusTone: Record<LeaveRequest["status"], string> = {
  pending: "bg-amber-50 text-amber-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-rose-50 text-rose-700",
  cancelled: "bg-slate-100 text-slate-500",
};

export default function StaffLeavePage() {
  const { session } = useStaff();
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<LeaveType>("annual");
  const [from, setFrom] = useState(todayIso());
  const [to, setTo] = useState(todayIso());
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function reload() {
    try {
      setRows((await fetchLeaves()).data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được đơn nghỉ.");
    }
  }

  useEffect(() => {
    void reload();
  }, [session.employeeId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
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
    try {
      await createLeave({
        type,
        from,
        to,
        reason: reason.trim(),
      });
      setOpen(false);
      setReason("");
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không gửi được đơn.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 pt-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Nghỉ phép</h1>
          <p className="mt-1 text-sm text-slate-400">
            Gửi đơn cho chủ quán duyệt
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-2xl bg-white px-3 py-2 text-sm font-semibold text-slate-900"
        >
          Xin nghỉ
        </button>
      </div>

      <div className="mt-5 space-y-2">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-slate-400">
            Chưa có yêu cầu nghỉ phép.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-white">
                    {row.type_label || leaveTypeLabels[row.type as LeaveType]}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {row.from} → {row.to} · {row.days} ngày
                  </p>
                  <p className="mt-2 text-sm text-slate-300">{row.reason}</p>
                </div>
                <span
                  className={clsx(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    statusTone[row.status],
                  )}
                >
                  {leaveStatusLabels[row.status]}
                </span>
              </div>
              {row.status === "pending" ? (
                <button
                  type="button"
                  onClick={() => {
                    void cancelLeave(row.id)
                      .then(() => reload())
                      .catch((err) => {
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Không hủy được đơn.",
                        );
                      });
                  }}
                  className="mt-3 text-xs font-medium text-rose-300"
                >
                  Hủy yêu cầu
                </button>
              ) : null}
            </div>
          ))
        )}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60 p-4 sm:items-center sm:justify-center">
          <form
            onSubmit={(e) => void onSubmit(e)}
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111827] p-5"
          >
            <h2 className="text-lg font-semibold text-white">Xin nghỉ phép</h2>
            {error ? (
              <p className="mt-2 text-sm text-rose-300">{error}</p>
            ) : null}
            <div className="mt-4 space-y-3">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as LeaveType)}
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
              >
                {(Object.keys(leaveTypeLabels) as LeaveType[]).map((k) => (
                  <option key={k} value={k}>
                    {leaveTypeLabels[k]}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
                />
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
                />
              </div>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Lý do..."
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-2xl border border-white/10 py-2.5 text-sm text-slate-300"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-2xl bg-white py-2.5 text-sm font-semibold text-slate-900 disabled:opacity-60"
              >
                {saving ? "Đang gửi..." : "Gửi"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
