"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ChevronDown, LogOut } from "lucide-react";
import { UserAvatar } from "@/components/dashboard/UserAvatar";
import { logout as apiLogout } from "@/lib/api";

export function UserMenu({
  name,
  roleLabel,
  variant = "admin",
}: {
  name: string;
  roleLabel?: string | null;
  variant?: "admin" | "staff";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await apiLogout();
    } finally {
      setBusy(false);
      setOpen(false);
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "flex items-center gap-2.5 rounded-xl border px-2.5 py-1.5 transition",
          variant === "admin"
            ? "border-slate-200 hover:bg-slate-50"
            : "border-white/10 bg-white/5 hover:bg-white/10",
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <UserAvatar name={name} className="h-9 w-9 rounded-full" />
        <div className="pr-0.5 text-left">
          <p
            className={clsx(
              "text-sm font-semibold",
              variant === "admin" ? "text-slate-800" : "text-white",
            )}
          >
            {name}
          </p>
          <p
            className={clsx(
              "text-[11px]",
              variant === "admin" ? "text-slate-500" : "text-slate-400",
            )}
          >
            {roleLabel ?? "Tài khoản"}
          </p>
        </div>
        <ChevronDown
          className={clsx(
            "h-4 w-4",
            variant === "admin" ? "text-slate-400" : "text-slate-500",
          )}
        />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-xl"
        >
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => void handleLogout()}
            className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" />
            {busy ? "Đang đăng xuất..." : "Đăng xuất"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
