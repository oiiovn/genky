"use client";

import clsx from "clsx";
import {
  Box,
  Crown,
  Lightbulb,
  Plus,
  Search,
  Settings2,
  Shield,
  User,
  Users,
} from "lucide-react";
import type { RoleItem } from "@/lib/roles-data";

const iconMap = {
  crown: Crown,
  shield: Shield,
  cash: Settings2,
  user: User,
  box: Box,
};

export function RolesListPanel({
  roles,
  selectedId,
  search,
  onSearchChange,
  onSelect,
  onAdd,
}: {
  roles: RoleItem[];
  selectedId: number | null;
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (id: number) => void;
  onAdd: () => void;
}) {
  const filtered = roles.filter((r) =>
    r.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <aside className="flex w-full flex-col rounded-2xl border border-slate-200 bg-white xl:w-[320px] xl:shrink-0">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="text-base font-semibold text-slate-800">
          Danh sách vai trò
        </h3>
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Tìm kiếm vai trò..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-3 pl-9 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:ring-2 focus:ring-orange-100"
          />
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {filtered.map((role) => {
          const Icon = iconMap[role.icon];
          const active = role.id === selectedId;
          return (
            <button
              key={role.id}
              type="button"
              onClick={() => onSelect(role.id)}
              className={clsx(
                "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
                active
                  ? "border-orange-400 bg-orange-50/70 shadow-sm"
                  : "border-transparent hover:border-slate-200 hover:bg-slate-50",
              )}
            >
              <div
                className={clsx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                  role.bg,
                )}
              >
                <Icon className={clsx("h-5 w-5", role.color)} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-800">
                    {role.name}
                  </p>
                  {role.isDefault ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                      Mặc định
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {role.description}
                </p>
                <p className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <Users className="h-3 w-3" />
                  {role.memberCount} người
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="space-y-3 border-t border-slate-100 p-4">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-orange-300 bg-orange-50/50 py-2.5 text-sm font-semibold text-orange-600 hover:bg-orange-50"
        >
          <Plus className="h-4 w-4" />
          Thêm vai trò mới
        </button>
        <div className="rounded-xl border border-sky-100 bg-sky-50/80 px-3.5 py-3">
          <div className="mb-1 flex items-center gap-1.5 text-sky-700">
            <Lightbulb className="h-4 w-4" />
            <p className="text-xs font-semibold">Gợi ý</p>
          </div>
          <p className="text-[11px] leading-relaxed text-sky-700/80">
            Tạo vai trò theo công việc thực tế (thu ngân, kho, phục vụ) rồi gán
            quyền tối thiểu cần thiết.
          </p>
        </div>
      </div>
    </aside>
  );
}
