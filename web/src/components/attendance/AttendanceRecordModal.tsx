"use client";

import { useEffect, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import {
  statusLabel,
  updateAttendance,
  type AttendanceRow,
} from "@/lib/attendance-api";
import type { Shift } from "@/lib/shifts-api";
import { EmployeeAvatar } from "@/components/ui/EmployeeAvatar";

function toHm(value?: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

function Field({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-slate-800">{value || "—"}</p>
    </div>
  );
}

export function AttendanceRecordModal({
  open,
  mode,
  row,
  shifts,
  onClose,
  onSaved,
  onEdit,
}: {
  open: boolean;
  mode: "view" | "edit";
  row: AttendanceRow | null;
  shifts: Shift[];
  onClose: () => void;
  onSaved: () => void;
  onEdit?: () => void;
}) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [shiftId, setShiftId] = useState<number | "">("");
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [breakMinutes, setBreakMinutes] = useState("0");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !row) return;
    setCheckIn(toHm(row.check_in));
    setCheckOut(toHm(row.check_out));
    setShiftId(row.shift_id ?? "");
    setLocation(row.location ?? "");
    setNote(row.note ?? "");
    setBreakMinutes(String(row.break_minutes ?? 0));
    setReason("");
    setError(null);
  }, [open, row]);

  if (!open || !row) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!row?.id) {
      setError("Chưa có bản ghi chấm công để sửa.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await updateAttendance(row.id, {
        check_in_at: checkIn ? `${row.work_date} ${checkIn}:00` : null,
        check_out_at: checkOut ? `${row.work_date} ${checkOut}:00` : null,
        shift_id: shiftId ? Number(shiftId) : null,
        location_label: location.trim() || null,
        note: note.trim() || null,
        break_minutes: Number(breakMinutes) || 0,
        reason: reason.trim() || "Cập nhật chấm công",
      });
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
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">
            {mode === "view" ? "Chi tiết chấm công" : "Sửa chấm công"}
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

        <div className="mb-4 flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-3">
          <EmployeeAvatar
            avatar={row.avatar}
            name={row.full_name}
            code={row.employee_code}
            className="h-11 w-11 rounded-full"
          />
          <div>
            <p className="font-semibold text-slate-800">{row.full_name}</p>
            <p className="text-xs text-slate-400">
              {row.employee_code} · {row.position}
            </p>
          </div>
        </div>

        {mode === "view" ? (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Ngày" value={row.work_date} />
              <Field
                label="Trạng thái"
                value={
                  row.ui_status === "on_leave" && row.leave_type_label
                    ? row.leave_type_label
                    : statusLabel[row.ui_status]
                }
              />
              <Field label="Ca làm" value={`${row.shift_name} (${row.shift_time})`} />
              <Field label="Tổng giờ" value={row.total_hours} />
              <Field label="Check-in" value={row.check_in} />
              <Field label="Check-out" value={row.check_out} />
              <Field label="Vị trí" value={row.location} />
              <Field label="Ghi chú" value={row.note} />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
              >
                Đóng
              </button>
              {row.id && onEdit ? (
                <button
                  type="button"
                  onClick={onEdit}
                  className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white"
                >
                  Sửa
                </button>
              ) : null}
            </div>
          </>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Ca làm
              </label>
              <select
                value={shiftId}
                onChange={(e) =>
                  setShiftId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Không chọn</option>
                {shifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({toHm(s.start_time)} - {toHm(s.end_time)})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Giờ vào
                </label>
                <input
                  type="time"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Giờ ra
                </label>
                <input
                  type="time"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Nghỉ giữa ca (phút)
              </label>
              <input
                type="number"
                min={0}
                max={480}
                value={breakMinutes}
                onChange={(e) => setBreakMinutes(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Vị trí
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Quầy thu ngân..."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Ghi chú
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Lý do chỉnh sửa
              </label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Sửa giờ vào/ra..."
              />
            </div>
            <div className="mt-2 flex justify-end gap-2">
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
                className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {loading ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
