"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CircleUserRound, Home, QrCode, Timer, Wallet } from "lucide-react";
import { useStaff } from "@/components/staff/StaffShell";

function shortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Hồ sơ";
  if (parts.length === 1) return parts[0].slice(0, 10);
  return parts[parts.length - 1].slice(0, 10);
}

export function StaffBottomNav() {
  const pathname = usePathname();
  const { session } = useStaff();
  const profileLabel = shortName(session.fullName);

  const items = [
    { href: "/m", label: "Trang chủ", icon: Home, exact: true },
    { href: "/m/attendance", label: "Chấm công", icon: Timer },
    { href: "/m/scan", label: "Quét QR", icon: QrCode, center: true },
    { href: "/m/payroll", label: "Lương", icon: Wallet },
    {
      href: "/m/profile",
      label: profileLabel,
      icon: CircleUserRound,
      title: session.fullName,
    },
  ] as const;

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-md px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="relative flex items-end justify-between rounded-2xl border border-white/10 bg-[#111827]/95 px-2 pt-2 pb-2 shadow-2xl shadow-black/40 backdrop-blur-xl">
        {items.map((item) => {
          const active = "exact" in item && item.exact
            ? pathname === item.href
            : pathname === item.href || pathname?.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const center = "center" in item && item.center;
          const title = "title" in item ? item.title : item.label;

          if (center) {
            return (
              <Link
                key={item.href}
                href={item.href}
                className="-mt-7 flex flex-col items-center"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-white shadow-lg shadow-sky-500/30 ring-4 ring-[#0B1220]">
                  <Icon className="h-6 w-6" />
                </span>
                <span className="mt-1 text-[10px] font-medium text-sky-200">
                  {item.label}
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              title={title}
              className={clsx(
                "flex min-w-[3.5rem] flex-1 flex-col items-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition",
                active ? "text-white" : "text-slate-400",
              )}
            >
              <Icon
                className={clsx(
                  "h-5 w-5",
                  active ? "text-sky-300" : "text-slate-500",
                )}
              />
              <span className="max-w-[3.5rem] truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
