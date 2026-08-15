"use client";

import { useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import clsx from "clsx";
import {
  Award,
  CalendarDays,
  ChevronDown,
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

type NavItemConfig = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
};

type NavGroup = {
  id: string;
  title: string;
  collapsible: boolean;
  items: NavItemConfig[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "hr",
    title: "Quản lý nhân sự",
    collapsible: true,
    items: [
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
    ],
  },
  {
    id: "reports",
    title: "Báo cáo",
    collapsible: false,
    items: [
      { label: "Hiệu suất", icon: TrendingUp, href: "#" },
      { label: "Chi phí nhân sự", icon: Wallet, href: "#" },
      { label: "Báo cáo", icon: FileBarChart, href: "#" },
    ],
  },
  {
    id: "system",
    title: "Hệ thống",
    collapsible: false,
    items: [{ label: "Cài đặt", icon: Settings, href: "/settings/general" }],
  },
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

function GroupItems({
  items,
  active,
  collapsed,
}: {
  items: NavItemConfig[];
  active?: string;
  collapsed?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      {items.map((item) => (
        <NavItem
          key={item.label}
          {...item}
          active={item.label === active}
          collapsed={collapsed}
        />
      ))}
    </div>
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
  const [manual, setManual] = useState<{
    active: string;
    open: boolean;
  } | null>(null);

  function toggleGroup(childActive: boolean) {
    const current = manual?.active === active ? manual.open : childActive;
    setManual({ active, open: !current });
  }

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
        {NAV_GROUPS.map((group) => {
          const childActive = group.items.some((item) => item.label === active);
          const open =
            !group.collapsible ||
            (manual?.active === active ? manual.open : childActive);
          const panelId = `nav-group-${group.id}`;

          if (collapsed) {
            return (
              <div key={group.id}>
                <GroupItems
                  items={group.items}
                  active={active}
                  collapsed
                />
              </div>
            );
          }

          if (!group.collapsible) {
            return (
              <div key={group.id}>
                <p className="mb-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                  {group.title}
                </p>
                <GroupItems items={group.items} active={active} />
              </div>
            );
          }

          return (
            <div key={group.id}>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                aria-label={group.title}
                onClick={() => toggleGroup(childActive)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
              >
                <Users className="h-4 w-4 text-slate-400" />
                <span className="flex-1 text-left">{group.title}</span>
                <ChevronDown
                  className={clsx(
                    "h-4 w-4 text-slate-400 transition-transform duration-150",
                    open && "rotate-180",
                  )}
                />
              </button>
              <div
                id={panelId}
                className={clsx(
                  "grid transition-[grid-template-rows] duration-150 ease-out",
                  open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <GroupItems items={group.items} active={active} />
                </div>
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
