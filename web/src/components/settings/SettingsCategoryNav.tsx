"use client";

import clsx from "clsx";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Building2,
  FileText,
  Layout,
  MapPin,
  Palette,
  ScrollText,
  Settings2,
  Shield,
} from "lucide-react";
import { settingsPath, type SettingsSection } from "@/lib/settings";

export type SettingsCategoryId = SettingsSection;

export const SETTINGS_CATEGORIES: {
  id: SettingsCategoryId;
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "general", label: "Chung", icon: Settings2 },
  { id: "company", label: "Thông tin công ty", icon: Building2 },
  { id: "branches", label: "Chi nhánh", icon: MapPin },
  { id: "security", label: "Tài khoản & Bảo mật", icon: Shield },
  { id: "activity", label: "Nhật ký hệ thống", icon: ScrollText },
  { id: "appearance", label: "Giao diện", icon: Palette },
  { id: "notifications", label: "Thông báo", icon: Bell },
];

export function SettingsCategoryNav({
  active,
}: {
  active: SettingsCategoryId;
}) {
  return (
    <aside className="w-full shrink-0 xl:w-[240px]">
      <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <nav className="space-y-0.5">
          {SETTINGS_CATEGORIES.map(({ id, label, icon: Icon }) => {
            const href = settingsPath(id);
            const isActive = active === id;
            return (
              <Link
                key={id}
                href={href}
                className={clsx(
                  "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition",
                  isActive
                    ? "bg-indigo-500 text-white shadow-sm"
                    : "text-slate-600 hover:bg-slate-50",
                )}
              >
                <Icon
                  className={clsx(
                    "h-4 w-4 shrink-0",
                    isActive ? "text-white" : "text-slate-400",
                  )}
                />
                <span className="truncate">{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

export function SettingsPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
      <FileText className="mx-auto h-10 w-10 text-slate-300" />
      <p className="mt-3 text-sm font-semibold text-slate-800">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  );
}

export function SettingsLayoutIcon({ className }: { className?: string }) {
  return <Layout className={className} />;
}
