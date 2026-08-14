"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  Bell,
  CalendarCheck,
  ChevronRight,
  FileText,
  Gift,
  Settings,
  Umbrella,
  UserPlus,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import type { DashboardData } from "@/types/dashboard";

type Notif = DashboardData["notifications"][number];
type NotifType = Notif["type"];

const READ_KEY = "genky_notif_read_ids";

const typeMeta: Record<
  NotifType,
  { Icon: LucideIcon; label: string; row: string; icon: string }
> = {
  leave: {
    Icon: Umbrella,
    label: "Đơn nghỉ chờ duyệt",
    row: "bg-rose-50/80 hover:bg-rose-50",
    icon: "bg-rose-100 text-rose-500",
  },
  employee: {
    Icon: UserPlus,
    label: "Nhân viên mới",
    row: "bg-sky-50/80 hover:bg-sky-50",
    icon: "bg-sky-100 text-sky-500",
  },
  shift: {
    Icon: CalendarCheck,
    label: "Ca làm việc",
    row: "bg-emerald-50/80 hover:bg-emerald-50",
    icon: "bg-emerald-100 text-emerald-600",
  },
  document: {
    Icon: FileText,
    label: "Báo cáo ngày",
    row: "bg-amber-50/80 hover:bg-amber-50",
    icon: "bg-amber-100 text-amber-600",
  },
  reward: {
    Icon: Gift,
    label: "Thưởng hoàn thành",
    row: "bg-violet-50/80 hover:bg-violet-50",
    icon: "bg-violet-100 text-violet-500",
  },
  warning: {
    Icon: AlertTriangle,
    label: "Cảnh báo",
    row: "bg-orange-50/80 hover:bg-orange-50",
    icon: "bg-orange-100 text-orange-500",
  },
};

function loadReadIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(READ_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
}

function present(item: Notif) {
  const meta = typeMeta[item.type] ?? typeMeta.document;
  return {
    title: item.title && item.message ? item.title : meta.label,
    message: item.message ?? item.title,
    time: item.time,
  };
}

function defaultUnread(item: Notif) {
  if (item.unread === true) return true;
  if (item.unread === false) return false;
  return item.type === "leave" || item.type === "warning" || item.type === "employee";
}

export function NotificationDropdown({
  items,
}: {
  items: Notif[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const sorted = useMemo(() => {
    const copy = [...(items ?? [])];
    copy.sort((a, b) => {
      if (a.type === "leave" && b.type !== "leave") return -1;
      if (a.type !== "leave" && b.type === "leave") return 1;
      return 0;
    });
    return copy;
  }, [items]);

  const unreadCount = sorted.filter(
    (item) => defaultUnread(item) && !readIds.has(String(item.id)),
  ).length;

  function markAllRead() {
    const next = new Set(readIds);
    for (const item of sorted) next.add(String(item.id));
    setReadIds(next);
    saveReadIds(next);
  }

  function openItem(item: Notif) {
    const next = new Set(readIds);
    next.add(String(item.id));
    setReadIds(next);
    saveReadIds(next);
    setOpen(false);

    if (item.type === "leave") {
      router.push("/leaves");
      return;
    }

    if (pathname === "/dashboard") {
      document.getElementById("notifications")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    router.push("/dashboard#notifications");
  }

  function viewAll() {
    setOpen(false);
    if (pathname === "/dashboard") {
      document.getElementById("notifications")?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    router.push("/dashboard#notifications");
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "relative rounded-xl border p-2.5 transition",
          open
            ? "border-sky-300 bg-sky-50 text-sky-600"
            : "border-sky-200 text-sky-500 hover:bg-sky-50",
        )}
        aria-label="Thông báo"
        aria-expanded={open}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 ? (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-40 mt-2.5 w-[min(380px,calc(100vw-24px))]">
          <div className="absolute -top-1.5 right-[14px] h-3 w-3 rotate-45 border-l border-t border-slate-200 bg-white" />
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <h3 className="text-sm font-bold text-slate-800">Thông báo</h3>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700"
                >
                  Đánh dấu tất cả đã đọc
                </button>
                <Link
                  href="/settings/notifications"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                  aria-label="Cài đặt thông báo"
                >
                  <Settings className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {sorted.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400">
                Chưa có thông báo
              </p>
            ) : (
              <ul className="max-h-[420px] space-y-2 overflow-y-auto px-3 pb-2">
                {sorted.map((item) => {
                  const meta = typeMeta[item.type] ?? typeMeta.document;
                  const Icon = meta.Icon;
                  const view = present(item);
                  const unread =
                    defaultUnread(item) && !readIds.has(String(item.id));

                  return (
                    <li key={String(item.id)}>
                      <button
                        type="button"
                        onClick={() => openItem(item)}
                        className={clsx(
                          "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition",
                          meta.row,
                        )}
                      >
                        <div
                          className={clsx(
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                            meta.icon,
                          )}
                        >
                          <Icon className="h-[18px] w-[18px]" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-800">
                            {view.title}
                          </p>
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                            {view.message}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {view.time}
                          </p>
                        </div>
                        {unread ? (
                          <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                        ) : (
                          <span className="mt-2 h-2 w-2 shrink-0" />
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <button
              type="button"
              onClick={viewAll}
              className="flex w-full items-center justify-center gap-1 border-t border-slate-100 py-3 text-sm font-medium text-indigo-600 hover:bg-slate-50"
            >
              Xem tất cả thông báo
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
