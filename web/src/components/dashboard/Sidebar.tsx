"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import clsx from "clsx";
import {
  Award,
  CalendarDays,
  ClipboardList,
  Clock,
  FileBarChart,
  LayoutDashboard,
  QrCode,
  Settings,
  Users,
  Wallet,
  Timer,
  TrendingUp,
  Umbrella,
} from "lucide-react";
import { useAppearance } from "@/components/appearance/AppearanceProvider";
import { CompanyBrand } from "@/components/dashboard/CompanyBrand";
import type { ShellData } from "@/types/dashboard";

const hrNav = [
  { label: "Tổng quan", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Nhân viên", icon: Users, href: "/employees" },
  { label: "Ca làm", icon: Clock, href: "/shifts" },
  { label: "Chấm công", icon: Timer, href: "/attendance" },
  { label: "QR chấm công", icon: QrCode, href: "/attendance/qr" },
  { label: "Lịch làm việc", icon: CalendarDays, href: "/schedule" },
  { label: "Bảng công", icon: ClipboardList, href: "/timesheet" },
  { label: "Lương", icon: Wallet, href: "/payroll" },
  { label: "Thưởng / Phạt", icon: Award, href: "/adjustments" },
  { label: "Nghỉ phép", icon: Umbrella, href: "/leaves" },
];

const reportNav = [
  { label: "Hiệu suất", icon: TrendingUp, href: "#" },
  { label: "Chi phí nhân sự", icon: Wallet, href: "#" },
  { label: "Báo cáo", icon: FileBarChart, href: "#" },
];

const systemNav = [
  { label: "Cài đặt", icon: Settings, href: "/settings/general" },
];

function InstantTip({
  label,
  enabled,
  children,
}: {
  label: string;
  enabled?: boolean;
  children: ReactNode;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  if (!enabled) return children;

  return (
    <span
      className="relative block w-full"
      onMouseEnter={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
      }}
      onMouseLeave={() => setPos(null)}
    >
      {children}
      {pos && typeof document !== "undefined"
        ? createPortal(
            <span
              className="pointer-events-none fixed z-[80] -translate-y-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-medium text-white shadow-lg"
              style={{ top: pos.top, left: pos.left }}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

function NavItem({
  label,
  icon: Icon,
  href,
  active,
  collapsed,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  active?: boolean;
  collapsed?: boolean;
}) {
  const className = clsx(
    "flex w-full items-center rounded-xl text-sm font-medium transition-colors",
    collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
    active
      ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200"
      : "text-slate-600 hover:bg-slate-100",
  );

  const content = (
    <>
      <Icon
        className={clsx("h-4 w-4", active ? "text-white" : "text-slate-400")}
      />
      {collapsed ? null : <span>{label}</span>}
    </>
  );

  const item =
    href === "#" ? (
      <button type="button" className={className}>
        {content}
      </button>
    ) : (
      <Link href={href} className={className}>
        {content}
      </Link>
    );

  return (
    <InstantTip label={label} enabled={collapsed}>
      {item}
    </InstantTip>
  );
}

export function Sidebar({
  tenant,
  active = "Tổng quan",
}: {
  tenant: ShellData["tenant"];
  active?: string;
  access?: unknown;
}) {
  const appearance = useAppearance();
  const collapsed = appearance.sidebar === "collapsed";

  return (
    <aside
      className={clsx(
        "flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ease-out",
        collapsed ? "w-[76px]" : "w-[260px]",
      )}
    >
      <div
        className={clsx(
          "flex items-center py-5",
          collapsed ? "justify-center px-2" : "gap-2.5 px-5",
        )}
      >
        <CompanyBrand name={tenant.name} collapsed={collapsed} />
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        <div>
          {collapsed ? null : (
            <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Quản lý nhân sự
            </p>
          )}
          <div className="space-y-0.5">
            {hrNav.map((item) => (
              <NavItem
                key={item.label}
                {...item}
                active={item.label === active}
                collapsed={collapsed}
              />
            ))}
          </div>
        </div>

        <div>
          {collapsed ? null : (
            <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Báo cáo
            </p>
          )}
          <div className="space-y-0.5">
            {reportNav.map((item) => (
              <NavItem key={item.label} {...item} collapsed={collapsed} />
            ))}
          </div>
        </div>

        <div>
          {collapsed ? null : (
            <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Hệ thống
            </p>
          )}
          <div className="space-y-0.5">
            {systemNav.map((item) => (
              <NavItem
                key={item.label}
                {...item}
                active={item.label === active}
                collapsed={collapsed}
              />
            ))}
          </div>
        </div>
      </nav>
    </aside>
  );
}
