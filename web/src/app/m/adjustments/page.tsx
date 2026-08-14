"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useStaff } from "@/components/staff/StaffShell";
import {
  CATEGORY_LABELS,
  computeAdjustmentStats,
  formatDate,
  formatMoney,
  type AdjustmentRecord,
} from "@/lib/adjustments";
import { fetchAdjustments } from "@/lib/adjustments-api";
import { currentMonth, currentYear } from "@/lib/timezone";

export default function StaffAdjustmentsPage() {
  const { session } = useStaff();
  const [year] = useState(currentYear());
  const [month] = useState(currentMonth());
  const [rows, setRows] = useState<AdjustmentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetchAdjustments({ year, month });
        setRows(
          res.data.filter((r) => r.employee_id === session.employeeId),
        );
      } catch {
        setRows([]);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [session.employeeId, year, month]);

  const stats = useMemo(() => computeAdjustmentStats(rows), [rows]);

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold text-white">Thưởng / Phạt</h1>
      <p className="mt-1 text-sm text-slate-400">
        Tháng {String(month).padStart(2, "0")}/{year}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
          <p className="text-xs text-emerald-200/80">Thưởng</p>
          <p className="mt-1 text-lg font-bold text-emerald-300">
            {formatMoney(stats.reward_total)}
          </p>
        </div>
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-4">
          <p className="text-xs text-rose-200/80">Phạt</p>
          <p className="mt-1 text-lg font-bold text-rose-300">
            {formatMoney(stats.penalty_total)}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-slate-400">
            Đang tải...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center text-sm text-slate-400">
            Chưa có thưởng/phạt trong tháng.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-white">{row.reason}</p>
                  <p className="mt-1 text-xs text-slate-400">
                    {CATEGORY_LABELS[row.category]} · {formatDate(row.date)}
                  </p>
                </div>
                <span
                  className={clsx(
                    "text-sm font-bold",
                    row.type === "reward" ? "text-emerald-300" : "text-rose-300",
                  )}
                >
                  {row.type === "reward" ? "+" : "-"}
                  {formatMoney(row.amount)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
