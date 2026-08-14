"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import {
  Box,
  Check,
  ChevronDown,
  Crown,
  LayoutDashboard,
  Pencil,
  Search,
  Settings2,
  Shield,
  User,
  Users,
  Wallet,
} from "lucide-react";
import {
  PERMISSION_GROUPS,
  ROLE_ACTIONS,
  type RoleAction,
  type RoleItem,
  type RolePermissionCell,
} from "@/lib/roles-data";

const iconMap = {
  crown: Crown,
  shield: Shield,
  cash: Settings2,
  user: User,
  box: Box,
};

const groupIcon: Record<string, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  hr: Users,
  payroll: Wallet,
  inventory: Box,
  system: Settings2,
};

type TabKey = "permissions" | "members" | "logs";

function PermissionCheckbox({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onChange}
      className={clsx(
        "mx-auto flex h-5 w-5 items-center justify-center rounded border transition-colors",
        disabled
          ? checked
            ? "cursor-not-allowed border-orange-300 bg-orange-200 text-white"
            : "cursor-not-allowed border-slate-100 bg-slate-50"
          : checked
            ? "border-orange-500 bg-orange-500 text-white"
            : "border-slate-300 bg-white hover:border-orange-400",
      )}
      aria-checked={checked}
      role="checkbox"
    >
      {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : null}
    </button>
  );
}

export function RoleDetailPanel({
  role,
  onToggle,
  onBulk,
  onEdit,
}: {
  role: RoleItem;
  onToggle: (rowId: string, action: RoleAction) => void;
  onBulk: (mode: "all" | "none" | "invert") => void;
  onEdit: () => void;
}) {
  const [tab, setTab] = useState<TabKey>("permissions");
  const [permSearch, setPermSearch] = useState("");
  const [category, setCategory] = useState("all");

  const Icon = iconMap[role.icon];
  const locked = Boolean(role.isDefault);

  const groups = useMemo(() => {
    const q = permSearch.trim().toLowerCase();
    return PERMISSION_GROUPS.filter((g) => category === "all" || g.id === category)
      .map((g) => ({
        ...g,
        rows: g.rows.filter(
          (r) =>
            !q ||
            r.label.toLowerCase().includes(q) ||
            r.description.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.rows.length > 0);
  }, [category, permSearch]);

  return (
    <section className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-start gap-3">
          <div
            className={clsx(
              "flex h-11 w-11 items-center justify-center rounded-xl",
              role.bg,
            )}
          >
            <Icon className={clsx("h-5 w-5", role.color)} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-800">{role.name}</h3>
            <p className="text-sm text-slate-500">{role.description}</p>
          </div>
        </div>
        {role.isDefault ? null : (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Chỉnh sửa thông tin
          </button>
        )}
      </div>

      <div className="flex gap-6 border-b border-slate-100 px-5">
        {(
          [
            { key: "permissions", label: "Phân quyền" },
            { key: "members", label: `Nhân viên (${role.memberCount})` },
            { key: "logs", label: "Nhật ký thay đổi" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={clsx(
              "relative py-3 text-sm font-medium transition-colors",
              tab === t.key
                ? "text-orange-600"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            {t.label}
            {tab === t.key ? (
              <span className="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-orange-500" />
            ) : null}
          </button>
        ))}
      </div>

      {tab === "permissions" ? (
        <div className="p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={permSearch}
                onChange={(e) => setPermSearch(e.target.value)}
                placeholder="Tìm kiếm chức năng..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pr-3 pl-9 text-sm outline-none placeholder:text-slate-400 focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
              />
            </div>
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pr-9 pl-3 text-sm text-slate-700 outline-none focus:border-orange-300"
              >
                <option value="all">Tất cả danh mục</option>
                {PERMISSION_GROUPS.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
            <div className="flex items-center gap-1 text-sm">
              <span className="mr-1 text-slate-400">Chọn nhanh:</span>
              <button
                type="button"
                disabled={locked}
                onClick={() => onBulk("all")}
                className="rounded-lg px-2.5 py-1.5 font-medium text-orange-600 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Toàn bộ
              </button>
              <button
                type="button"
                disabled={locked}
                onClick={() => onBulk("none")}
                className="rounded-lg px-2.5 py-1.5 font-medium text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Bỏ chọn
              </button>
              <button
                type="button"
                disabled={locked}
                onClick={() => onBulk("invert")}
                className="rounded-lg px-2.5 py-1.5 font-medium text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Đảo ngược
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold tracking-wide text-slate-500 uppercase">
                  <th className="px-4 py-3 font-semibold">Chức năng</th>
                  {ROLE_ACTIONS.map((a) => (
                    <th key={a.key} className="w-20 px-2 py-3 text-center">
                      {a.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => {
                  const GIcon = groupIcon[group.id] ?? LayoutDashboard;
                  return (
                    <GroupRows
                      key={group.id}
                      label={group.label}
                      Icon={GIcon}
                      rows={group.rows}
                      permissions={role.permissions}
                      locked={locked}
                      onToggle={onToggle}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "members" ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">
          Có {role.memberCount} nhân viên đang dùng vai trò này.
        </div>
      ) : null}

      {tab === "logs" ? (
        <div className="px-5 py-10 text-center text-sm text-slate-500">
          Chưa có nhật ký thay đổi cho vai trò này.
        </div>
      ) : null}
    </section>
  );
}

function GroupRows({
  label,
  Icon,
  rows,
  permissions,
  locked,
  onToggle,
}: {
  label: string;
  Icon: typeof LayoutDashboard;
  rows: { id: string; label: string; description: string; actions: RoleAction[] }[];
  permissions: Record<string, RolePermissionCell>;
  locked?: boolean;
  onToggle: (rowId: string, action: RoleAction) => void;
}) {
  return (
    <>
      <tr className="bg-slate-50/60">
        <td colSpan={6} className="px-4 py-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            <Icon className="h-3.5 w-3.5 text-slate-400" />
            {label}
          </div>
        </td>
      </tr>
      {rows.map((row) => {
        const cell = permissions[row.id];
        return (
          <tr key={row.id} className="border-t border-slate-100">
            <td className="px-4 py-3.5">
              <p className="font-medium text-slate-800">{row.label}</p>
              <p className="text-xs text-slate-400">{row.description}</p>
            </td>
            {ROLE_ACTIONS.map((action) => {
              const supported = row.actions.includes(action.key);
              return (
                <td key={action.key} className="px-2 py-3.5 text-center">
                  {supported ? (
                    <PermissionCheckbox
                      checked={Boolean(cell?.[action.key])}
                      disabled={locked}
                      onChange={() => onToggle(row.id, action.key)}
                    />
                  ) : (
                    <span className="mx-auto block h-5 w-5 rounded border border-transparent" />
                  )}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}
