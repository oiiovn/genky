"use client";

import {
  ChevronDown,
  MapPin,
  Menu,
} from "lucide-react";
import { useAppearance } from "@/components/appearance/AppearanceProvider";
import { NotificationDropdown } from "@/components/dashboard/NotificationDropdown";
import { UserMenu } from "@/components/dashboard/UserMenu";
import type { ShellData } from "@/types/dashboard";

export function Header({
  data,
}: {
  data: ShellData;
  subtitle?: string;
}) {
  const appearance = useAppearance();

  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            appearance.toggleSidebar();
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            appearance.toggleSidebar();
          }}
          className="relative z-10 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-indigo-200 bg-indigo-50 text-slate-600 hover:bg-indigo-100 active:bg-indigo-200"
          aria-label={
            appearance.sidebar === "collapsed" ? "Mở menu" : "Thu gọn menu"
          }
        >
          <Menu className="pointer-events-none h-5 w-5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
        >
          <MapPin className="h-4 w-4 text-indigo-500" />
          <span className="font-medium">
            {data.branch?.name ?? "Chưa có chi nhánh"}
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>

        <NotificationDropdown items={data.notifications ?? []} />

        <UserMenu
          name={data.greeting.name}
          roleLabel={data.role_label ?? "Quản trị viên"}
        />
      </div>
    </header>
  );
}
