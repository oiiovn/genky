"use client";

import { useEffect, useMemo, useState } from "react";
import { Wallet, X } from "lucide-react";
import {
  fetchPayrolls,
  formatMoney,
  payPayroll,
  type PayrollPayMethod,
  type PayrollRow,
} from "@/lib/payroll-api";

const METHODS: { value: PayrollPayMethod; label: string }[] = [
  { value: "cash", label: "Tiền mặt" },
  { value: "bank", label: "Chuyển khoản ngân hàng" },
  { value: "transfer", label: "Chuyển khoản nội bộ" },
  { value: "other", label: "Khác" },
];

export function PayrollPayModal({
  open,
  year,
  month,
  monthLabel,
  defaultEmployeeId,
  onClose,
  onPaid,
}: {
  open: boolean;
  year: number;
  month: number;
  monthLabel: string;
  defaultEmployeeId?: number | null;
  onClose: () => void;
  onPaid: (msg: string) => void;
}) {
  const [rows, setRows] = useState<PayrollRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [employeeId, setEmployeeId] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayrollPayMethod>("cash");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const payable = useMemo(
    () =>
      rows.filter(
        (r) => (r.remaining ?? Math.max(0, r.net - (r.paid_amount ?? 0))) > 0,
      ),
    [rows],
  );

  const selected = payable.find((r) => r.id === employeeId) ?? null;
  const remaining = selected
    ? (selected.remaining ??
      Math.max(0, selected.net - (selected.paid_amount ?? 0)))
    : 0;

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingRows(true);
    setError(null);
    setMethod("cash");
    setContent("");
    void fetchPayrolls({ year, month, per_page: 100, page: 1 })
      .then((res) => {
        if (cancelled) return;
        const list = res.data ?? [];
        setRows(list);
        const payableList = list.filter(
          (r) =>
            (r.remaining ?? Math.max(0, r.net - (r.paid_amount ?? 0))) > 0,
        );
        const initial =
          (defaultEmployeeId &&
            payableList.find((r) => r.id === defaultEmployeeId)?.id) ||
          payableList[0]?.id ||
          "";
        setEmployeeId(initial);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Không tải được danh sách.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRows(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, year, month, defaultEmployeeId]);

  useEffect(() => {
    if (!selected) {
      setAmount("");
      return;
    }
    setAmount(String(remaining));
  }, [selected?.id, remaining]);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) {
      setError("Chọn nhân viên.");
      return;
    }
    const value = Number(String(amount).replace(/\D/g, ""));
    if (!value || value <= 0) {
      setError("Nhập số tiền hợp lệ.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await payPayroll({
        year,
        month,
        employee_id: Number(employeeId),
        amount: value,
        method,
        content: content.trim() || undefined,
      });
      onPaid(
        `Đã thanh toán ${formatMoney(value)}. Còn lại ${formatMoney(res.entry.remaining)}.`,
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Thanh toán thất bại.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <Wallet className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-800">
                Thanh toán lương
              </h3>
              <p className="text-xs text-slate-400">{monthLabel}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error ? (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        {loadingRows ? (
          <p className="py-8 text-center text-sm text-slate-500">Đang tải...</p>
        ) : payable.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Không còn nhân viên nào cần thanh toán trong tháng này.
          </p>
        ) : (
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Nhân viên
              </label>
              <select
                value={employeeId}
                onChange={(e) =>
                  setEmployeeId(e.target.value ? Number(e.target.value) : "")
                }
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              >
                {payable.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.employee.employee_code} — {r.employee.full_name} (còn{" "}
                    {formatMoney(
                      r.remaining ??
                        Math.max(0, r.net - (r.paid_amount ?? 0)),
                    )}
                    )
                  </option>
                ))}
              </select>
            </div>

            {selected ? (
              <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs">
                <div>
                  <p className="text-slate-400">Thực nhận</p>
                  <p className="font-semibold text-slate-800">
                    {formatMoney(selected.net)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Đã trả</p>
                  <p className="font-semibold text-slate-800">
                    {formatMoney(selected.paid_amount ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-400">Còn lại</p>
                  <p className="font-semibold text-amber-600">
                    {formatMoney(remaining)}
                  </p>
                </div>
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Số tiền
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                required
              />
              {remaining > 0 ? (
                <button
                  type="button"
                  onClick={() => setAmount(String(remaining))}
                  className="mt-1 text-xs font-medium text-indigo-600 hover:underline"
                >
                  Thanh toán hết còn lại
                </button>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Hình thức
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PayrollPayMethod)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Nội dung
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={2}
                placeholder="Thanh toán lương tháng..."
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
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
                className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-60"
              >
                {loading ? "Đang thanh toán..." : "Thanh toán"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
