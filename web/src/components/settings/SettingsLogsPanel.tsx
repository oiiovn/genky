"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Monitor,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Smartphone,
} from "lucide-react";
import type { AuthUser } from "@/lib/api";
import {
  exportActivityLogs,
  fetchActivityLogs,
  type ActivityMeta,
  type ActivityUser,
  type LogAction,
  type LogResult,
  type SystemLog,
} from "@/lib/activity-api";

const ACTION_STYLE: Record<string, { badge: string; label: string }> = {
  create: { badge: "bg-emerald-50 text-emerald-600", label: "Tạo mới" },
  update: { badge: "bg-blue-50 text-blue-600", label: "Cập nhật" },
  delete: { badge: "bg-amber-50 text-amber-600", label: "Xóa" },
  login: { badge: "bg-violet-50 text-violet-600", label: "Đăng nhập" },
  logout: { badge: "bg-violet-50 text-violet-600", label: "Đăng xuất" },
};

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function displayDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 6);
  return { from: isoDate(from), to: isoDate(to) };
}

function pageItems(current: number, last: number): Array<number | "…"> {
  if (last <= 1) return last === 1 ? [1] : [];
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const items: Array<number | "…"> = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(last - 1, current + 1);
  if (start > 2) items.push("…");
  for (let p = start; p <= end; p += 1) items.push(p);
  if (end < last - 1) items.push("…");
  items.push(last);
  return items;
}

function avatarOf(row: SystemLog): string {
  if (row.avatar) return row.avatar;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(row.user_name || "?")}&background=eef2ff&color=4338ca`;
}

const selectClass =
  "appearance-none rounded-xl border border-slate-200 bg-white bg-[length:16px] bg-[right_10px_center] bg-no-repeat py-2 pr-8 pl-3 text-sm text-slate-600 outline-none focus:border-indigo-400";

export function SettingsLogsPanel({
  onToast,
}: {
  user: AuthUser | null;
  onToast: (msg: string) => void;
}) {
  const defaults = useMemo(() => defaultRange(), []);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [userFilter, setUserFilter] = useState<number | "">("");
  const [actionFilter, setActionFilter] = useState<"" | LogAction>("");
  const [resultFilter, setResultFilter] = useState<"" | LogResult>("");
  const [from, setFrom] = useState(defaults.from);
  const [to, setTo] = useState(defaults.to);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [tick, setTick] = useState(0);

  const [rows, setRows] = useState<SystemLog[]>([]);
  const [users, setUsers] = useState<ActivityUser[]>([]);
  const [meta, setMeta] = useState<ActivityMeta>({
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
    from: null,
    to: null,
  });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchActivityLogs({
      search: debouncedSearch || undefined,
      user_id: userFilter || undefined,
      action: actionFilter || undefined,
      result: resultFilter || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      per_page: perPage,
    })
      .then((res) => {
        if (cancelled) return;
        setRows(res.data);
        setUsers(res.users);
        setMeta(res.meta);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setRows([]);
        onToast(err instanceof Error ? err.message : "Không tải được nhật ký");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    debouncedSearch,
    userFilter,
    actionFilter,
    resultFilter,
    from,
    to,
    page,
    perPage,
    tick,
    onToast,
  ]);

  const lastPage = Math.max(1, meta.last_page || 1);
  const pageSafe = Math.min(Math.max(1, page), lastPage);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <h3 className="text-base font-bold text-slate-800">Nhật ký hệ thống</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Theo dõi tất cả hoạt động của người dùng trong hệ thống
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={exporting}
            onClick={async () => {
              try {
                setExporting(true);
                await exportActivityLogs({
                  search: debouncedSearch || undefined,
                  user_id: userFilter || undefined,
                  action: actionFilter || undefined,
                  result: resultFilter || undefined,
                  from: from || undefined,
                  to: to || undefined,
                });
                onToast("Đã xuất nhật ký");
              } catch (err: unknown) {
                onToast(err instanceof Error ? err.message : "Không xuất được nhật ký");
              } finally {
                setExporting(false);
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
            Xuất Excel
          </button>
          <button
            type="button"
            onClick={() => {
              setTick((n) => n + 1);
              onToast("Đã làm mới nhật ký");
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Làm mới
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm kiếm hành động, người dùng..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-indigo-400"
          />
        </div>
        <select
          value={userFilter === "" ? "" : String(userFilter)}
          onChange={(e) => {
            setUserFilter(e.target.value ? Number(e.target.value) : "");
            setPage(1);
          }}
          className={selectClass}
        >
          <option value="">Tất cả người dùng</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value as "" | LogAction);
            setPage(1);
          }}
          className={selectClass}
        >
          <option value="">Tất cả hành động</option>
          <option value="create">Tạo mới</option>
          <option value="update">Cập nhật</option>
          <option value="delete">Xóa</option>
          <option value="login">Đăng nhập</option>
          <option value="logout">Đăng xuất</option>
        </select>
        <select
          value={resultFilter}
          onChange={(e) => {
            setResultFilter(e.target.value as "" | LogResult);
            setPage(1);
          }}
          className={selectClass}
        >
          <option value="">Tất cả kết quả</option>
          <option value="success">Thành công</option>
          <option value="fail">Thất bại</option>
        </select>
        <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
          <CalendarDays className="h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
            className="w-[118px] bg-transparent text-sm outline-none"
            aria-label="Từ ngày"
          />
          <span className="text-slate-300">–</span>
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
            className="w-[118px] bg-transparent text-sm outline-none"
            aria-label="Đến ngày"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            const range = defaultRange();
            setSearch("");
            setUserFilter("");
            setActionFilter("");
            setResultFilter("");
            setFrom(range.from);
            setTo(range.to);
            setPage(1);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Bộ lọc
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-[1060px] w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
              <th className="px-5 py-3">Thời gian</th>
              <th className="px-4 py-3">Người dùng</th>
              <th className="px-4 py-3">Hành động</th>
              <th className="px-4 py-3">Đối tượng</th>
              <th className="px-4 py-3">Kết quả</th>
              <th className="px-5 py-3">IP thiết bị</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center text-slate-400">
                  Đang tải nhật ký...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-16 text-center text-slate-400">
                  Không có nhật ký phù hợp.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const style = ACTION_STYLE[row.action] ?? ACTION_STYLE.update;
                const DeviceIcon = row.device === "phone" ? Smartphone : Monitor;
                return (
                  <tr
                    key={row.id}
                    className="border-b border-slate-50 last:border-0 hover:bg-slate-50/70"
                  >
                    <td className="whitespace-nowrap px-5 py-3.5 text-slate-600">
                      {row.time}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={avatarOf(row)}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover"
                        />
                        <div>
                          <p className="font-semibold text-slate-800">
                            {row.user_name}
                          </p>
                          <p className="text-xs text-slate-400">{row.role}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={clsx(
                            "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            style.badge,
                          )}
                        >
                          {style.label}
                        </span>
                        <span className="text-slate-700">{row.action_label}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-700">{row.object}</td>
                    <td className="px-4 py-3.5">
                      {row.result === "success" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Thành công
                        </span>
                      ) : (
                        <div>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                            Thất bại
                          </span>
                          {row.error ? (
                            <p className="mt-1 max-w-[240px] text-[11px] leading-snug text-rose-500">
                              {row.error}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-slate-600">
                        {row.ip}
                        <DeviceIcon className="h-4 w-4 text-slate-400" />
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3 text-sm text-slate-500">
        <p>
          Hiển thị {meta.from ?? 0} đến {meta.to ?? 0} trong tổng số {meta.total} nhật
          ký
          {from && to ? ` · ${displayDate(from)} - ${displayDate(to)}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2">
            <span>Hiển thị</span>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none"
            >
              {[10, 20, 50].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <span>dòng</span>
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pageSafe <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40"
              aria-label="Trang trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            {pageItems(pageSafe, lastPage).map((item, idx) =>
              item === "…" ? (
                <span key={`e-${idx}`} className="px-1 text-slate-400">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  onClick={() => setPage(item)}
                  className={clsx(
                    "h-8 min-w-8 rounded-lg px-2 text-sm font-medium",
                    pageSafe === item
                      ? "bg-indigo-500 text-white"
                      : "text-slate-600 hover:bg-slate-100",
                  )}
                >
                  {item}
                </button>
              ),
            )}
            <button
              type="button"
              disabled={pageSafe >= lastPage}
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 disabled:opacity-40"
              aria-label="Trang sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
