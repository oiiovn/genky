"use client";

import { useState } from "react";
import { useStaff } from "@/components/staff/StaffShell";

export default function StaffProfilePage() {
  const { session, logout } = useStaff();
  const user = session.me.user;
  const [busy, setBusy] = useState(false);

  async function handleLogout() {
    if (busy) return;
    const ok = window.confirm("Đăng xuất khỏi thiết bị này?");
    if (!ok) return;
    setBusy(true);
    try {
      await logout();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold text-white">Hồ sơ</h1>
      <p className="mt-1 text-sm text-slate-400">{session.orgName}</p>

      <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-500 text-lg font-bold text-white">
            {session.fullName.slice(0, 1)}
          </div>
          <div>
            <p className="text-lg font-semibold text-white">{session.fullName}</p>
            <p className="text-sm text-slate-400">{session.employeeCode}</p>
          </div>
        </div>

        <dl className="mt-5 space-y-3 text-sm">
          <div className="flex justify-between gap-3 border-t border-white/5 pt-3">
            <dt className="text-slate-400">Email</dt>
            <dd className="text-right text-white">{user.email}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-white/5 pt-3">
            <dt className="text-slate-400">Điện thoại</dt>
            <dd className="text-right text-white">{user.phone ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-white/5 pt-3">
            <dt className="text-slate-400">Chi nhánh</dt>
            <dd className="text-right text-white">
              {session.branches.map((b) => b.name).join(", ") || "—"}
            </dd>
          </div>
        </dl>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void handleLogout()}
        className="mt-6 w-full rounded-2xl border border-rose-400/30 bg-rose-500/10 py-3 text-sm font-semibold text-rose-200 disabled:opacity-60"
      >
        {busy ? "Đang đăng xuất..." : "Đăng xuất"}
      </button>
    </div>
  );
}
