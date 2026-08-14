"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Wallet } from "lucide-react";
import { useStaff } from "@/components/staff/StaffShell";
import {
  fetchPayrollHistory,
  fetchPayrollPayments,
  fetchPayrolls,
  type PayrollHistorySheet,
  type PayrollPaymentGroup,
  type PayrollRow,
  type PayrollStatus,
} from "@/lib/payroll-api";
import { formatVnd } from "@/lib/staff";
import { currentMonth, currentYear } from "@/lib/timezone";

const statusLabel: Record<PayrollStatus, string> = {
  paid: "Đã thanh toán",
  pending: "Chờ thanh toán",
  draft: "Nháp",
  partial: "Thanh toán một phần",
};

const statusTone: Record<PayrollStatus, string> = {
  paid: "bg-emerald-50 text-emerald-700",
  pending: "bg-amber-50 text-amber-700",
  draft: "bg-slate-100 text-slate-600",
  partial: "bg-sky-50 text-sky-700",
};

const methodLabel: Record<string, string> = {
  cash: "Tiền mặt",
  bank: "Ngân hàng",
  transfer: "Chuyển khoản",
  other: "Khác",
};

function formatPaidAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type PaymentItem = PayrollPaymentGroup["payments"][number];

export default function StaffPayrollPage() {
  const { session } = useStaff();
  const [year, setYear] = useState(currentYear());
  const [month, setMonth] = useState(currentMonth());
  const [row, setRow] = useState<PayrollRow | null>(null);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [paidSheets, setPaidSheets] = useState<PayrollHistorySheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchPayrolls({
          year,
          month,
          per_page: 20,
        });
        const mine =
          res.data.find((r) => r.employee.id === session.employeeId) ??
          res.data[0] ??
          null;
        setRow(mine);
      } catch (err) {
        setRow(null);
        setError(err instanceof Error ? err.message : "Không tải được lương.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [year, month, session.employeeId]);

  useEffect(() => {
    async function loadHistory() {
      setHistoryLoading(true);
      try {
        const [payRes, sheetRes] = await Promise.all([
          fetchPayrollPayments({ per_page: 50 }).catch(() => null),
          fetchPayrollHistory({ per_page: 24 }).catch(() => null),
        ]);
        const group =
          payRes?.data.find((g) => g.employee_id === session.employeeId) ??
          payRes?.data[0] ??
          null;
        setPayments(group?.payments ?? []);
        setPaidSheets(
          (sheetRes?.data ?? []).filter(
            (s) => s.status === "completed" || s.paid_count > 0,
          ),
        );
      } finally {
        setHistoryLoading(false);
      }
    }
    void loadHistory();
  }, [session.employeeId]);

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  }

  return (
    <div className="px-4 pt-6 pb-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Bảng lương</h1>
          <p className="mt-1 text-sm text-slate-400">Theo dõi lương của bạn</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
          >
            ‹
          </button>
          <span className="text-sm font-medium text-sky-200">
            {String(month).padStart(2, "0")}/{year}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white"
          >
            ›
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {error}
        </div>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-400/20 to-orange-500/10 p-5">
        {loading ? (
          <p className="text-sm text-slate-300">Đang tải...</p>
        ) : row ? (
          <>
            <p className="text-xs font-medium text-amber-100/80">Thực lĩnh</p>
            <p className="mt-1 text-3xl font-bold text-white">
              {formatVnd(row.net)}
            </p>
            <span
              className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[row.status]}`}
            >
              {statusLabel[row.status]}
            </span>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-black/20 p-3">
                <p className="text-xs text-slate-400">Thu nhập</p>
                <p className="mt-1 font-semibold text-emerald-300">
                  {formatVnd(row.income)}
                </p>
              </div>
              <div className="rounded-2xl bg-black/20 p-3">
                <p className="text-xs text-slate-400">Đã trả</p>
                <p className="mt-1 font-semibold text-sky-300">
                  {formatVnd(row.paid_amount)}
                </p>
              </div>
              <div className="col-span-2 rounded-2xl bg-black/20 p-3">
                <p className="text-xs text-slate-400">Còn lại</p>
                <p className="mt-1 font-semibold text-white">
                  {formatVnd(row.remaining)}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-slate-400">
              Công: {Math.round(row.total_minutes / 60)} giờ ·{" "}
              {row.position || "—"}
            </p>
          </>
        ) : (
          <p className="text-sm text-slate-300">
            Chưa có bảng lương tháng này.
          </p>
        )}
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">
            Lịch sử đã thanh toán
          </h2>
          <span className="text-xs text-slate-400">
            {payments.length > 0 ? `${payments.length} lần` : null}
          </span>
        </div>

        {historyLoading ? (
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-slate-400">
            Đang tải lịch sử...
          </p>
        ) : payments.length > 0 ? (
          <ul className="space-y-2">
            {payments.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setYear(p.year);
                    setMonth(p.month);
                  }}
                  className="flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-left"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{p.label}</p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {methodLabel[p.method] ?? p.method}
                      {p.content ? ` · ${p.content}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {formatPaidAt(p.paid_at)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-emerald-300">
                    {formatVnd(p.amount)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : paidSheets.length > 0 ? (
          <ul className="space-y-2">
            {paidSheets.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => {
                    setYear(s.year);
                    setMonth(s.month);
                  }}
                  className="flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/5 p-3.5 text-left"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-white">{s.label}</p>
                    <p className="mt-0.5 text-xs text-slate-400">Đã thanh toán</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {formatPaidAt(s.last_paid_at)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-emerald-300">
                    {formatVnd(s.fund)}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed border-white/15 px-4 py-8 text-center text-sm text-slate-400">
            Chưa có khoản lương đã thanh toán.
          </p>
        )}
      </section>
    </div>
  );
}
