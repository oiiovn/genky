"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, ChevronDown, MapPin, Menu } from "lucide-react";
import { useAdminShell } from "@/components/admin/AdminShell";
import { useAppearance } from "@/components/appearance/AppearanceProvider";
import { NotificationDropdown } from "@/components/dashboard/NotificationDropdown";
import { UserMenu } from "@/components/dashboard/UserMenu";
import { switchCurrentBranch } from "@/lib/api";
import type { ShellData } from "@/types/dashboard";

export function Header({
  data,
}: {
  data: ShellData;
  subtitle?: string;
}) {
  const appearance = useAppearance();
  const { refreshShell } = useAdminShell();
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const branches = data.branches ?? [];
  const canSwitch = branches.length > 1;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function selectBranch(branchId: number) {
    if (!canSwitch || switching || branchId === data.branch?.id) {
      setOpen(false);
      return;
    }
    setSwitching(true);
    try {
      await switchCurrentBranch(branchId);
      await refreshShell();
      setOpen(false);
    } catch {
      /* keep menu open on failure */
    } finally {
      setSwitching(false);
    }
  }

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
        <div className="relative" ref={rootRef}>
          <button
            type="button"
            disabled={!canSwitch || switching}
            aria-expanded={open}
            aria-haspopup="listbox"
            onClick={() => {
              if (!canSwitch) return;
              setOpen((v) => !v);
            }}
            className={clsx(
              "flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700",
              canSwitch
                ? "hover:bg-slate-50 disabled:opacity-60"
                : "cursor-default opacity-90",
            )}
          >
            <MapPin className="h-4 w-4 text-indigo-500" />
            <span className="font-medium">
              {data.branch?.name ?? "Chưa có chi nhánh"}
            </span>
            {canSwitch ? (
              <ChevronDown
                className={clsx(
                  "h-4 w-4 text-slate-400 transition",
                  open && "rotate-180",
                )}
              />
            ) : null}
          </button>

          {open && canSwitch ? (
            <div
              role="listbox"
              className="absolute right-0 z-50 mt-2 max-h-72 w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
            >
              {branches.map((branch) => {
                const selected = branch.id === data.branch?.id;
                return (
                  <button
                    key={branch.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    disabled={switching}
                    onClick={() => void selectBranch(branch.id)}
                    className={clsx(
                      "flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-slate-50",
                      selected
                        ? "bg-indigo-50 font-medium text-indigo-700"
                        : "text-slate-700",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">
                      {branch.is_headquarters
                        ? `Chi nhánh ${branch.name}`
                        : branch.name}
                    </span>
                    {selected ? (
                      <Check className="h-4 w-4 shrink-0 text-indigo-600" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        <NotificationDropdown items={data.notifications ?? []} />

        <UserMenu
          name={data.greeting.name}
          roleLabel={data.role_label ?? "Quản trị viên"}
        />
      </div>
    </header>
  );
}
