"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Branch } from "@/lib/api";
import type { Employee } from "@/lib/employees-api";
import {
  checkInAttendance,
  checkOutAttendance,
  type AttendanceRow,
} from "@/lib/attendance-api";
import type { Shift } from "@/lib/shifts-api";
import { nowHm } from "@/lib/timezone";

function toHm(value?: string | null): string {
  if (!value) return "";
  return value.slice(0, 5);
}

export function QuickAttendanceModal({
  open,
  onClose,
  onSaved,
  employees,
  branches,
  shifts,
  date,
  defaultBranchId,
  selfOnly = false,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  employees: Employee[];
  branches: Branch[];
  shifts: Shift[];
  date: string;
  defaultBranchId?: number;
  selfOnly?: boolean;
}) {
  const [employeeId, setEmployeeId] = useState<number | "">(
    employees[0]?.id ?? "",
  );
  const [branchId, setBranchId] = useState<number | "">(
    defaultBranchId ?? branches[0]?.id ?? "",
  );
  const [shiftId, setShiftId] = useState<number | "">(shifts[0]?.id ?? "");
  const [workDate, setWorkDate] = useState(date);
  const [location, setLocation] = useState("");
  const [checkInTime, setCheckInTime] = useState(nowHm);
  const [checkOutTime, setCheckOutTime] = useState(nowHm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<AttendanceRow | null>(null);

  useEffect(() => {
    if (!open) return;
    setWorkDate(date);
    setCheckInTime(nowHm());
    setCheckOutTime(nowHm());
    setError(null);
    setLast(null);
    if (employees[0]?.id) {
      setEmployeeId(employees[0].id);
      const primary =
        employees[0].branches.find((b) => b.is_primary)?.id ??
        employees[0].branches[0]?.id;
      if (primary) setBranchId(primary);
    }
  }, [open, date, employees]);

  useEffect(() => {
    if (!shiftId) return;
    const shift = shifts.find((s) => s.id === Number(shiftId));
    if (!shift) return;
    const start = toHm(shift.start_time);
    const end = toHm(shift.end_time);
    if (start) setCheckInTime(start);
    if (end) setCheckOutTime(end);
  }, [shiftId, shifts]);

  if (!open) return null;

  async function run(action: "in" | "out") {
    if (!employeeId || !branchId) {
      setError("Chọn nhân viên và chi nhánh.");
      return;
    }
    if (!workDate) {
      setError("Chọn ngày làm việc.");
      return;
    }
    if (action === "in" && !checkInTime) {
      setError("Chọn giờ vào.");
      return;
    }
    if (action === "out" && !checkOutTime) {
      setError("Chọn giờ ra.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const row =
        action === "in"
          ? await checkInAttendance({
              employee_id: Number(employeeId),
              branch_id: Number(branchId),
              shift_id: shiftId ? Number(shiftId) : null,
              location_label: location.trim() || undefined,
              work_date: workDate,
              check_in_time: checkInTime,
            })
          : await checkOutAttendance({
              employee_id: Number(employeeId),
              branch_id: Number(branchId),
              work_date: workDate,
              check_out_time: checkOutTime,
            });
      setLast(row);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể chấm công.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">
            Check-in / Check-out
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
        {last && (
          <div className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {last.full_name}:{" "}
            {last.ui_status === "working" ? "Đã check-in" : "Đã check-out"}
            {last.check_in ? ` · vào ${last.check_in}` : ""}
            {last.check_out ? ` · ra ${last.check_out}` : ""}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nhân viên
            </label>
            {selfOnly ? (
              <input
                readOnly
                value={
                  employees[0]
                    ? `${employees[0].employee_code} — ${employees[0].full_name}`
                    : "Không tìm thấy hồ sơ nhân viên của bạn"
                }
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              />
            ) : (
              <select
                value={employeeId}
                onChange={(e) =>
                  setEmployeeId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.employee_code} — {e.full_name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Chi nhánh
            </label>
            <select
              value={branchId}
              onChange={(e) =>
                setBranchId(e.target.value ? Number(e.target.value) : "")
              }
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
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
              <option value="">Tự động / không chọn</option>
              {shifts.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.start_time} - {s.end_time})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Ngày
            </label>
            <input
              type="date"
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Giờ vào
              </label>
              <input
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Giờ ra
              </label>
              <input
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Vị trí
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Quầy thu ngân..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => void run("in")}
            className="rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            Check-in
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => void run("out")}
            className="rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            Check-out
          </button>
        </div>
      </div>
    </div>
  );
}
