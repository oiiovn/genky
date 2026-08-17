"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import { ArrowLeft, CheckCircle2, XCircle } from "lucide-react";
import { useStaff } from "@/components/staff/StaffShell";
import { getStaffGeolocation } from "@/lib/attendance-api";
import {
  parseQrScanValue,
  scanAttendanceQr,
} from "@/lib/attendance-qr-api";

const QrScanner = dynamic(
  () => import("@/components/staff/QrScanner").then((mod) => mod.QrScanner),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-white/10 bg-black text-sm text-slate-300">
        Đang mở camera...
      </div>
    ),
  },
);

export default function StaffScanPage() {
  const { session } = useStaff();
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    ok: boolean;
    title: string;
    detail: string;
  } | null>(null);

  const handleScan = useCallback(
    async (raw: string) => {
      if (busy) return;
      setBusy(true);
      setPaused(true);
      try {
        const payload = parseQrScanValue(raw);
        const { latitude, longitude } = await getStaffGeolocation();

        const res = await scanAttendanceQr({
          employee_id: session.employeeId,
          branch_id: payload.branch_id,
          slot: payload.slot,
          token: payload.token,
          action: "auto",
          latitude,
          longitude,
          device: navigator.userAgent.slice(0, 180),
        });

        const actionLabel =
          res.action === "check_out" ? "Check-out thành công" : "Check-in thành công";
        setResult({
          ok: true,
          title: actionLabel,
          detail: `${res.data.full_name} · ${res.data.branch_name ?? "Chi nhánh"} · ${
            res.action === "check_out"
              ? res.data.check_out ?? ""
              : res.data.check_in ?? ""
          }`,
        });
      } catch (err) {
        setResult({
          ok: false,
          title: "Quét không thành công",
          detail: err instanceof Error ? err.message : "Thử lại với mã QR mới.",
        });
      } finally {
        setBusy(false);
      }
    },
    [busy, session.employeeId],
  );

  return (
    <div className="flex min-h-dvh flex-col px-4 pt-4 pb-6">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/m"
          className="rounded-full border border-white/10 bg-white/5 p-2 text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-white">Quét QR chấm công</h1>
          <p className="text-xs text-slate-400">
            Cần bật GPS · Đưa camera vào mã QR tại chi nhánh
          </p>
        </div>
      </div>

      <QrScanner onScan={(t) => void handleScan(t)} paused={paused || busy} />

      <p className="mt-4 text-center text-xs text-slate-400">
        Hệ thống tự chọn Check-in hoặc Check-out theo trạng thái hôm nay.
      </p>

      {result ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#111827] p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              {result.ok ? (
                <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-400" />
              ) : (
                <XCircle className="mt-0.5 h-6 w-6 text-rose-400" />
              )}
              <div>
                <p className="font-semibold text-white">{result.title}</p>
                <p className="mt-1 text-sm text-slate-400">{result.detail}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setPaused(false);
              }}
              className="mt-5 w-full rounded-2xl bg-white py-3 text-sm font-semibold text-slate-900"
            >
              {result.ok ? "Tiếp tục" : "Thử lại"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
