"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Award,
  CalendarDays,
  ChevronRight,
  LogIn,
  LogOut,
  QrCode,
  Timer,
  Umbrella,
  Wallet,
} from "lucide-react";
import { useStaff } from "@/components/staff/StaffShell";
import {
  checkInAttendance,
  checkOutAttendance,
  fetchStaffCheckStatus,
  getStaffGeolocation,
  statusLabel,
  statusTone,
  type StaffCheckStatus,
} from "@/lib/attendance-api";
import { fetchPayrolls, type PayrollRow } from "@/lib/payroll-api";
import { formatVnd } from "@/lib/staff";
import { currentMonth, currentYear } from "@/lib/timezone";

const quick = [
  { href: "/m/scan", label: "Quét QR", icon: QrCode, tone: "from-sky-400 to-indigo-500" },
  { href: "/m/attendance", label: "Chấm công", icon: Timer, tone: "from-emerald-400 to-teal-500" },
  { href: "/m/payroll", label: "Bảng lương", icon: Wallet, tone: "from-amber-400 to-orange-500" },
  { href: "/m/leave", label: "Nghỉ phép", icon: Umbrella, tone: "from-violet-400 to-fuchsia-500" },
];

const payStatus: Record<string, string> = {
  paid: "Đã thanh toán",
  pending: "Chờ thanh toán",
  draft: "Nháp",
  partial: "Trả một phần",
};

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function StaffHomePage() {
  const { session } = useStaff();
  const [check, setCheck] = useState<StaffCheckStatus | null>(null);
  const [payroll, setPayroll] = useState<PayrollRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [waitLeft, setWaitLeft] = useState(0);
  const month = currentMonth();
  const year = currentYear();

  const primaryBranchId =
    session.branches.find((b) => b.is_primary)?.id ?? session.branches[0]?.id;

  const reloadCheck = useCallback(async () => {
    const status = await fetchStaffCheckStatus(primaryBranchId);
    setCheck(status);
    setWaitLeft(status.today.seconds_until_checkout ?? 0);
  }, [primaryBranchId]);

  useEffect(() => {
    async function load() {
      try {
        const [status, pay] = await Promise.all([
          fetchStaffCheckStatus(primaryBranchId).catch(() => null),
          fetchPayrolls({ year, month, per_page: 20 }).catch(() => null),
        ]);
        setCheck(status);
        setWaitLeft(status?.today.seconds_until_checkout ?? 0);
        const minePay =
          pay?.data.find((r) => r.employee.id === session.employeeId) ??
          pay?.data[0] ??
          null;
        setPayroll(minePay);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [session.employeeId, year, month, primaryBranchId]);

  const countingDown = waitLeft > 0;
  useEffect(() => {
    if (!countingDown) return;
    const id = window.setInterval(() => {
      setWaitLeft((prev) => {
        const next = Math.max(0, prev - 1);
        if (next === 0) {
          void reloadCheck().catch(() => undefined);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [countingDown, reloadCheck]);

  async function runAction(kind: "in" | "out") {
    if (!check || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const geo = await getStaffGeolocation();
      if (kind === "in") {
        await checkInAttendance({
          employee_id: check.employee_id,
          branch_id: check.branch.id,
          latitude: geo.latitude,
          longitude: geo.longitude,
          source: "staff_app",
          location_label: `App · ${check.branch.name}`,
        });
      } else {
        await checkOutAttendance({
          employee_id: check.employee_id,
          branch_id: check.branch.id,
          latitude: geo.latitude,
          longitude: geo.longitude,
          source: "staff_app",
        });
      }
      await reloadCheck();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Không thể chấm công.");
    } finally {
      setBusy(false);
    }
  }

  const hour = new Date().getHours();
  const hello =
    hour < 12 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  const today = check?.today;
  const showCheckIn = Boolean(today?.can_check_in);
  const showCheckOut =
    Boolean(today?.can_check_out) ||
    (Boolean(check?.allow_staff_app) &&
      Boolean(check?.allow_check_out) &&
      today?.ui_status === "working" &&
      waitLeft > 0);

  return (
    <div className="px-4 pt-4">
      <header className="mb-6">
        <p className="text-xs font-semibold tracking-[0.2em] text-sky-300/80 uppercase">
          Genky Staff
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          {hello}, {session.fullName.split(" ").slice(-1)[0]}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {session.orgName} · {session.employeeCode}
        </p>
      </header>

      <section className="mb-5 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-sky-500/20 via-indigo-500/10 to-transparent p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-sky-200/80">Hôm nay</p>
            <p className="mt-1 text-lg font-semibold text-white">
              {loading
                ? "Đang tải..."
                : today
                  ? statusLabel[today.ui_status]
                  : "Chưa có dữ liệu ca"}
            </p>
            {today ? (
              <p className="mt-1 text-sm text-slate-300">
                Vào {today.check_in ?? "—"} · Ra {today.check_out ?? "—"}
              </p>
            ) : null}
            {check ? (
              <p className="mt-1 text-xs text-slate-400">{check.branch.name}</p>
            ) : null}
          </div>
          {today ? (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone[today.ui_status]}`}
            >
              Ca làm
            </span>
          ) : null}
        </div>

        {actionError ? (
          <p className="mt-3 rounded-2xl bg-rose-500/15 px-3 py-2 text-xs text-rose-200">
            {actionError}
          </p>
        ) : null}

        {showCheckIn || showCheckOut ? (
          <div className="mt-4 grid gap-2">
            {showCheckIn ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void runAction("in")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-60"
              >
                <LogIn className="h-4 w-4" />
                {busy ? "Đang xử lý..." : "Check-in"}
              </button>
            ) : null}
            {showCheckOut ? (
              <button
                type="button"
                disabled={busy || waitLeft > 0 || !today?.can_check_out}
                onClick={() => void runAction("out")}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-60"
              >
                <LogOut className="h-4 w-4" />
                {waitLeft > 0
                  ? `Check-out sau ${formatCountdown(waitLeft)}`
                  : busy
                    ? "Đang xử lý..."
                    : "Check-out"}
              </button>
            ) : null}
          </div>
        ) : check && !check.allow_staff_app ? (
          <p className="mt-4 text-xs text-slate-400">
            Chủ quán chưa bật Check-in trên app cho{" "}
            <span className="text-slate-300">{check.branch.name}</span>. Hãy quét
            mã QR để chấm công.
          </p>
        ) : null}

        <Link
          href="/m/scan"
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-semibold text-white"
        >
          <QrCode className="h-4 w-4" />
          Quét mã QR chấm công
        </Link>
      </section>

      <Link
        href="/m/payroll"
        className="mb-5 block overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-400/25 via-orange-500/10 to-transparent p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-amber-100/80">
              Lương tháng {String(month).padStart(2, "0")}/{year}
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              {loading
                ? "..."
                : payroll
                  ? formatVnd(payroll.net)
                  : "Chưa có dữ liệu"}
            </p>
            {payroll ? (
              <p className="mt-1 text-xs text-slate-300">
                {payStatus[payroll.status] ?? payroll.status} ·{" "}
                {Math.round(payroll.total_minutes / 60)} giờ công
              </p>
            ) : null}
          </div>
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white">
            <Wallet className="h-5 w-5" />
          </span>
        </div>
        {payroll ? (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-black/20 px-3 py-2.5">
              <p className="text-[11px] text-slate-400">Đã trả</p>
              <p className="mt-0.5 text-sm font-semibold text-sky-300">
                {formatVnd(payroll.paid_amount)}
              </p>
            </div>
            <div className="rounded-2xl bg-black/20 px-3 py-2.5">
              <p className="text-[11px] text-slate-400">Còn lại</p>
              <p className="mt-0.5 text-sm font-semibold text-white">
                {formatVnd(payroll.remaining)}
              </p>
            </div>
          </div>
        ) : null}
        <p className="mt-3 flex items-center justify-end gap-1 text-xs font-medium text-amber-200/80">
          Xem bảng lương
          <ChevronRight className="h-3.5 w-3.5" />
        </p>
      </Link>

      <section className="mb-5 grid grid-cols-2 gap-3">
        {quick.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur transition active:scale-[0.98]"
            >
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${item.tone} text-white`}
              >
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-white">{item.label}</p>
            </Link>
          );
        })}
      </section>

      <section className="space-y-2">
        <Link
          href="/m/adjustments"
          className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
        >
          <span className="flex items-center gap-3 text-sm text-slate-200">
            <Award className="h-4 w-4 text-amber-300" />
            Thưởng / Phạt của tôi
          </span>
          <ChevronRight className="h-4 w-4 text-slate-500" />
        </Link>
        <Link
          href="/m/profile"
          className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3"
        >
          <span className="flex items-center gap-3 text-sm text-slate-200">
            <CalendarDays className="h-4 w-4 text-sky-300" />
            Hồ sơ & đăng xuất
          </span>
          <ChevronRight className="h-4 w-4 text-slate-500" />
        </Link>
      </section>
    </div>
  );
}
