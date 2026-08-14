"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BookOpen, Plus } from "lucide-react";
import { Header } from "@/components/dashboard/Header";
import { Sidebar } from "@/components/dashboard/Sidebar";
import { RoleDetailPanel } from "@/components/roles/RoleDetailPanel";
import { RoleFormModal } from "@/components/roles/RoleFormModal";
import { RolesListPanel } from "@/components/roles/RolesListPanel";
import { fetchDashboard, getAccessToken, me } from "@/lib/api";
import {
  createRole,
  fetchRoles,
  updateRole,
  updateRolePermissions,
  type ApiRole,
} from "@/lib/roles-api";
import {
  PERMISSION_GROUPS,
  type RoleAction,
  type RoleItem,
  type RolePermissionCell,
} from "@/lib/roles-data";
import type { DashboardData } from "@/types/dashboard";

function mapRole(role: ApiRole): RoleItem {
  return {
    id: role.id,
    slug: role.slug,
    name: role.name,
    description: role.description,
    memberCount: role.member_count,
    isDefault: role.is_default,
    isSystem: role.is_system,
    icon: role.icon,
    color: role.color,
    bg: role.bg,
    permissions: role.permissions,
  };
}

export default function RolesPage() {
  const router = useRouter();
  const [shell, setShell] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [roleSearch, setRoleSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleItem | null>(null);
  const [savingPerms, setSavingPerms] = useState(false);

  const loadRoles = useCallback(async (preferId?: number | null) => {
    const data = await fetchRoles();
    const mapped = data.map(mapRole);
    setRoles(mapped);
    setSelectedId((prev) => {
      const want = preferId ?? prev;
      if (want && mapped.some((r) => r.id === want)) return want;
      return mapped[0]?.id ?? null;
    });
  }, []);

  useEffect(() => {
    async function boot() {
      if (!getAccessToken()) {
        router.replace("/login");
        return;
      }
      try {
        await me();
        const dash = await fetchDashboard();
        setShell(dash);
        await loadRoles();
      } catch (err) {
        if (!getAccessToken()) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "Không tải được vai trò.");
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, [router, loadRoles]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const selected = useMemo(
    () => roles.find((r) => r.id === selectedId) ?? roles[0] ?? null,
    [roles, selectedId],
  );

  const headerData = useMemo(() => {
    if (!shell) return null;
    return {
      ...shell,
      greeting: {
        ...shell.greeting,
        message: "Quản lý vai trò và quyền hạn trong hệ thống",
      },
    };
  }, [shell]);

  async function persistPermissions(
    roleId: number,
    permissions: Record<string, RolePermissionCell>,
  ) {
    setSavingPerms(true);
    setError(null);
    try {
      const updated = await updateRolePermissions(roleId, permissions);
      setRoles((prev) =>
        prev.map((r) => (r.id === roleId ? mapRole(updated) : r)),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được quyền.");
      await loadRoles(roleId);
    } finally {
      setSavingPerms(false);
    }
  }

  function toggle(rowId: string, action: RoleAction) {
    if (!selected || selected.isDefault) return;
    const nextPerms = { ...selected.permissions };
    const cell = { ...(nextPerms[rowId] ?? {
      view: false,
      create: false,
      update: false,
      delete: false,
      export: false,
    }) };
    cell[action] = !cell[action];
    nextPerms[rowId] = cell;
    setRoles((prev) =>
      prev.map((r) =>
        r.id === selected.id ? { ...r, permissions: nextPerms } : r,
      ),
    );
    void persistPermissions(selected.id, nextPerms);
  }

  function bulk(mode: "all" | "none" | "invert") {
    if (!selected || selected.isDefault) return;
    const next = { ...selected.permissions };
    for (const group of PERMISSION_GROUPS) {
      for (const row of group.rows) {
        const cell = { ...(next[row.id] ?? {
          view: false,
          create: false,
          update: false,
          delete: false,
          export: false,
        }) };
        for (const action of row.actions) {
          if (mode === "all") cell[action] = true;
          else if (mode === "none") cell[action] = false;
          else cell[action] = !cell[action];
        }
        next[row.id] = cell;
      }
    }
    setRoles((prev) =>
      prev.map((r) =>
        r.id === selected.id ? { ...r, permissions: next } : r,
      ),
    );
    void persistPermissions(selected.id, next);
  }

  function openCreate() {
    setEditingRole(null);
    setFormOpen(true);
  }

  function openEdit() {
    if (!selected || selected.isDefault) return;
    setEditingRole(selected);
    setFormOpen(true);
  }

  async function saveRoleInfo(payload: { name: string; description: string }) {
    setError(null);
    try {
      if (editingRole) {
        const updated = await updateRole(editingRole.id, payload);
        setRoles((prev) =>
          prev.map((r) => (r.id === editingRole.id ? mapRole(updated) : r)),
        );
        setToast("Đã cập nhật tên và mô tả vai trò.");
        return;
      }
      const created = await createRole(payload);
      const mapped = mapRole(created);
      setRoles((prev) => [...prev, mapped]);
      setSelectedId(mapped.id);
      setToast("Đã tạo vai trò mới.");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Không lưu được vai trò.";
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    }
  }

  if (loading || !shell || !headerData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] text-slate-500">
        Đang tải...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F3F4F6]">
      <Sidebar tenant={shell.tenant} active="Vai trò & Quyền" access={shell.access} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          data={headerData}
          subtitle="Quản lý vai trò và quyền hạn trong hệ thống"
        />

        <main className="flex-1 overflow-y-auto p-5 lg:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                Vai trò & Quyền
              </h2>
              <p className="text-sm text-slate-500">
                Tạo vai trò cho nhân viên và phân quyền sử dụng hệ thống
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setToast("Hướng dẫn phân quyền sẽ được bổ sung sau.")
                }
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <BookOpen className="h-4 w-4" />
                Hướng dẫn phân quyền
              </button>
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600"
              >
                <Plus className="h-4 w-4" />
                Thêm vai trò
              </button>
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </div>
          ) : null}
          {toast ? (
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {toast}
            </div>
          ) : null}
          {savingPerms ? (
            <p className="mb-3 text-xs text-slate-400">Đang lưu quyền...</p>
          ) : null}

          <div className="flex flex-col gap-5 xl:flex-row">
            <RolesListPanel
              roles={roles}
              selectedId={selected?.id ?? null}
              search={roleSearch}
              onSearchChange={setRoleSearch}
              onSelect={setSelectedId}
              onAdd={openCreate}
            />
            {selected ? (
              <RoleDetailPanel
                role={selected}
                onToggle={toggle}
                onBulk={bulk}
                onEdit={openEdit}
              />
            ) : (
              <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-400">
                Chưa có vai trò
              </div>
            )}
          </div>
        </main>
      </div>

      <RoleFormModal
        open={formOpen}
        editing={editingRole}
        onClose={() => setFormOpen(false)}
        onSubmit={saveRoleInfo}
      />
    </div>
  );
}
