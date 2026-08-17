"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { Branch } from "@/lib/api";
import type { Employee } from "@/lib/employees-api";
import { bulkScheduleAssignments } from "@/lib/schedule-api";
import type { Shift } from "@/lib/shifts-api";
import { todayIso } from "@/lib/timezone";

const WEEKDAY_OPTIONS = [
  { value: 1, label: "T2" },
  { value: 2, label: "T3" },
  { value: 3, label: "T4" },
  { value: 4, label: "T5" },
  { value: 5, label: "T6" },
  { value: 6, label: "T7" },
  { value: 7, label: "CN" },
];

export function ScheduleBulkAssignModal({
  open,
  employees,
  branches,
  shifts,
  defaultBranchId,
  defaultDateFrom,
  defaultDateTo,
  onClose,
  onDone,
}: {
  open: boolean;
  employees: Employee[];
  branches: Branch[];
  shifts: Shift[];
  defaultBranchId: number | "";
  defaultDateFrom: string;
  defaultDateTo: string;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [shiftId, setShiftId] = useState<number | "">("");
  const [branchId, setBranchId] = useState<number | "">(defaultBranchId);
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5, 6, 7]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setShiftId("");
    setBranchId(defaultBranchId);
    setDateFrom(defaultDateFrom < todayIso() ? todayIso() : defaultDateFrom);
    setDateTo(defaultDateTo < todayIso() ? todayIso() : defaultDateTo);
    setWeekdays([1, 2, 3, 4, 5, 6, 7]);
    setSearch("");
    setError(null);
  }, [open, defaultBranchId, defaultDateFrom, defaultDateTo]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter(
      (e) =>
        e.full_name.toLowerCase().includes(q) ||
        e.employee_code.toLowerCase().includes(q),
    );
  }, [employees, search]);

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((e) => selected.includes(e.id));

  if (!open) return null;

  function toggleEmployee(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function toggleWeekday(value: number) {
    setWeekdays((prev) =>
      prev.includes(value)
        ? prev.filter((v) => v !== value)
        : [...prev, value].sort((a, b) => a - b),
    );
  }

  function toggleAllFiltered() {
    if (allFilteredSelected) {
      const ids = new Set(filtered.map((e) => e.id));
      setSelected((prev) => prev.filter((id) => !ids.has(id)));
    } else {
      const ids = filtered.map((e) => e.id);
      setSelected((prev) => Array.from(new Set([...prev, ...ids])));
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selected.length === 0) {
      setError("Chọn ít nhất một nhân viên.");
      return;
    }
    if (!shiftId || !branchId) {
      setError("Chọn ca và chi nhánh.");
      return;
    }
    if (weekdays.length === 0) {
      setError("Chọn ít nhất một thứ trong tuần.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await bulkScheduleAssignments({
        employee_ids: selected,
        shift_id: Number(shiftId),
        branch_id: Number(branchId),
        date_from: dateFrom,
        date_to: dateTo,
        weekdays,
      });
      onDone(
        `Đã xếp ${result.created} ca` +
          (result.skipped > 0 ? `, bỏ qua ${result.skipped} ca trùng/lỗi` : ""),
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xếp ca thất bại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">
              Xếp ca hàng loạt
            </h3>
            <p className="text-sm text-slate-500">
              Chọn nhiều nhân viên, một ca và khoảng ngày
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

        <form
          onSubmit={(e) => void onSubmit(e)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
            {error ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {error}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Từ ngày
                </label>
                <input
                  type="date"
                  required
                  min={todayIso()}
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Đến ngày
                </label>
                <input
                  type="date"
                  required
                  min={dateFrom}
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">
                Thứ trong tuần
              </p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_OPTIONS.map((w) => (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() => toggleWeekday(w.value)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                      weekdays.includes(w.value)
                        ? "bg-indigo-500 text-white"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Ca làm
                </label>
                <select
                  required
                  value={shiftId === "" ? "" : String(shiftId)}
                  onChange={(e) =>
                    setShiftId(e.target.value ? Number(e.target.value) : "")
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Chọn ca</option>
                  {shifts.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
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
                  value={branchId === "" ? "" : String(branchId)}
                  onChange={(e) =>
                    setBranchId(e.target.value ? Number(e.target.value) : "")
                  }
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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

            <div>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-700">
                  Nhân viên ({selected.length} đã chọn)
                </p>
                <button
                  type="button"
                  onClick={toggleAllFiltered}
                  className="text-xs font-semibold text-indigo-600"
                >
                  {allFilteredSelected ? "Bỏ chọn" : "Chọn tất cả"}
                </button>
              </div>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm nhân viên..."
                className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-slate-100 p-2">
                {filtered.map((e) => (
                  <li key={e.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selected.includes(e.id)}
                        onChange={() => toggleEmployee(e.id)}
                        className="rounded border-slate-300"
                      />
                      <span className="truncate text-sm text-slate-800">
                        {e.full_name}{" "}
                        <span className="text-slate-400">{e.employee_code}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex gap-2 border-t border-slate-100 px-5 py-4">
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
              {loading ? "Đang xếp..." : "Xếp ca"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
