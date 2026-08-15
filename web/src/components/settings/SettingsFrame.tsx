"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { SettingsCategoryNav, SETTINGS_CATEGORIES } from "@/components/settings/SettingsCategoryNav";
import { useSettingsData } from "@/components/settings/SettingsContext";
import {
  isSettingsSection,
  settingsPath,
  type SettingsSection,
} from "@/lib/settings";

function sectionFromPath(pathname: string): SettingsSection {
  const slug = pathname.replace(/^\/settings\/?/, "").split("/")[0] || "general";
  return isSettingsSection(slug) ? slug : "general";
}

export function SettingsChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const section = sectionFromPath(pathname);
  const { toast } = useSettingsData();
  const current = SETTINGS_CATEGORIES.find((c) => c.id === section);

  return (
    <>
      <main className="flex-1 overflow-y-auto p-5 lg:p-6">
        <div className="mb-5">
          <h2 className="text-xl font-bold text-slate-800">Cài đặt</h2>
          <p className="text-sm text-slate-500">
            Quản lý hệ thống và tùy chỉnh ứng dụng
          </p>
          {section !== "general" ? (
            <nav className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
              <Home className="h-3.5 w-3.5" />
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <Link
                href={settingsPath("general")}
                className="hover:text-indigo-600"
              >
                Cài đặt
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
              <span className="font-medium text-slate-700">
                {current?.label}
              </span>
            </nav>
          ) : null}
        </div>

        <div className="flex flex-col gap-5 xl:flex-row">
          <SettingsCategoryNav active={section} />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </main>

      {toast ? (
        <div className="fixed right-5 bottom-5 z-50 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </>
  );
}
