"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  Clock,
  Grid2X2,
  LayoutDashboard,
  Menu,
  Timer,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { CompanyBrand } from "@/components/dashboard/CompanyBrand";
import { NotificationDropdown } from "@/components/dashboard/NotificationDropdown";
import {
  NAV_GROUPS,
  activeFromPathname,
} from "@/components/dashboard/Sidebar";
import { UserAvatar } from "@/components/dashboard/UserAvatar";
import { logout as apiLogout } from "@/lib/api";
import type { ShellData } from "@/types/dashboard";

const BOTTOM_TABS = [
  { href: "/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/employees", label: "Nhân viên", icon: Users },
  { href: "/attendance", label: "Chấm công", icon: Timer },
  { href: "/payroll", label: "Lương", icon: Wallet },
] as const;

function brandLabel(name: string) {
  const raw = name?.trim() && name !== "—" ? name : "GENKY";
  const first = raw.split(/[\s\-–—_/|]+/).find(Boolean) ?? raw;
  return first.toUpperCase();
}

export function MobileAdminShell({
  data,
  children,
  onRefreshShell,
  sidebar,
  header,
}: {
  data: ShellData;
  children: ReactNode;
  onRefreshShell: () => Promise<unknown>;
  sidebar: ReactNode;
  header: ReactNode;
}) {
  const [drawer, setDrawer] = useState(false);
  const [more, setMore] = useState(false);

  useEffect(() => {
    document.body.style.overflow = drawer || more ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawer, more]);

  return (
    <div className="flex min-h-dvh bg-[#F3F4F6]">
      <div className="hidden lg:flex">{sidebar}</div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="hidden lg:block">{header}</div>
        <div className="lg:hidden">
          <MobileAdminHeader
            data={data}
            onOpenMenu={() => setDrawer(true)}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </div>
      </div>
      <div className="lg:hidden">
        <MobileBottomNav onMore={() => setMore(true)} />
        {drawer ? (
          <MobileDrawer data={data} onClose={() => setDrawer(false)} />
        ) : null}
        {more ? (
          <MoreSheet data={data} onClose={() => setMore(false)} />
        ) : null}
      </div>
    </div>
  );
}

function MobileAdminHeader({
  data,
  onOpenMenu,
}: {
  data: ShellData;
  onOpenMenu: () => void;
}) {
  const router = useRouter();
  const [userOpen, setUserOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [userOpen]);

  async function handleLogout() {
    if (busy) return;
    setBusy(true);
    try {
      await apiLogout();
    } finally {
      setBusy(false);
      router.replace("/login");
      router.refresh();
    }
  }

  return (
    <header
      ref={rootRef}
      className="sticky top-0 z-30 border-b border-slate-200 bg-white px-3 pt-[max(0.65rem,env(safe-area-inset-top))] pb-2.5"
    >
      <div className="relative flex items-center justify-between">
        <button
          type="button"
          onClick={onOpenMenu}
          className="flex h-10 w-10 shrink-0 items-center justify-center text-slate-700"
          aria-label="Mở menu"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div className="pointer-events-none absolute inset-x-12 flex items-center justify-center">
          <CompanyBrand name={brandLabel(data.tenant.name)} />
        </div>

        <div className="flex items-center gap-1.5">
          <NotificationDropdown items={data.notifications ?? []} />
          <button
            type="button"
            onClick={() => setUserOpen((v) => !v)}
            className="relative shrink-0"
            aria-label="Tài khoản"
          >
            <UserAvatar
              name={data.greeting.name}
              className="h-9 w-9 rounded-full"
            />
            <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
          </button>
        </div>
      </div>

      {userOpen ? (
        <div className="absolute right-3 z-50 mt-2 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
          <p className="px-3.5 py-2 text-xs text-slate-400">
            {data.role_label ?? "Quản trị viên"}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleLogout()}
            className="flex w-full px-3.5 py-2.5 text-left text-sm font-medium text-rose-600"
          >
            {busy ? "Đang đăng xuất..." : "Đăng xuất"}
          </button>
        </div>
      ) : null}
    </header>
  );
}

function MobileBottomNav({ onMore }: { onMore: () => void }) {
  const pathname = usePathname() ?? "";
  const moreActive =
    pathname !== "/dashboard" &&
    !pathname.startsWith("/employees") &&
    !pathname.startsWith("/attendance") &&
    !pathname.startsWith("/payroll");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <div className="grid grid-cols-5">
        {BOTTOM_TABS.map((tab) => {
          const active =
            pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
                active ? "text-indigo-600" : "text-slate-400",
              )}
            >
              <Icon className="h-5 w-5" />
              {tab.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          className={clsx(
            "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
            moreActive ? "text-indigo-600" : "text-slate-400",
          )}
        >
          <Grid2X2 className="h-5 w-5" />
          Thêm
        </button>
      </div>
    </nav>
  );
}

function MobileDrawer({
  data,
  onClose,
}: {
  data: ShellData;
  onClose: () => void;
}) {
  const pathname = usePathname() ?? "";
  const active = activeFromPathname(pathname);

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Đóng menu"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-[min(86vw,320px)] flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-4">
          <CompanyBrand name={data.tenant.name} />
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.id} className="mb-5">
              <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
                {group.title}
              </p>
              {group.items
                .filter((item) => item.href !== "#")
                .map((item) => {
                  const Icon = item.icon;
                  const isActive = item.label === active;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className={clsx(
                        "mb-0.5 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium",
                        isActive
                          ? "bg-indigo-50 text-indigo-700"
                          : "text-slate-600",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="flex-1">{item.label}</span>
                      {item.badge ? (
                        <span className="rounded-md bg-orange-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
            </div>
          ))}
        </nav>
      </aside>
    </div>
  );
}

function MoreSheet({
  data,
  onClose,
}: {
  data: ShellData;
  onClose: () => void;
}) {
  const pathname = usePathname() ?? "";
  const items = useMemo(
    () =>
      NAV_GROUPS.flatMap((group) => group.items).filter(
        (item) =>
          item.href !== "#" &&
          !["/dashboard", "/employees", "/attendance", "/payroll"].includes(
            item.href,
          ),
      ),
    [],
  );

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Đóng"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-slate-200" />
        <div className="flex items-center justify-between px-5 pt-3 pb-2">
          <p className="text-sm font-semibold text-slate-800">Thêm</p>
          <button type="button" onClick={onClose} className="p-1 text-slate-400">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="px-5 pb-3 text-xs text-slate-400">{data.tenant.name}</p>
        <div className="grid grid-cols-3 gap-2 px-4">
          {items.map((item) => {
            const Icon = item.icon ?? Clock;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={clsx(
                  "flex flex-col items-center gap-2 rounded-2xl border px-2 py-3 text-center text-[11px] font-medium",
                  active
                    ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                    : "border-slate-100 bg-slate-50 text-slate-600",
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
