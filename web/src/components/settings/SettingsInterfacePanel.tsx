"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  Bell,
  Check,
  Moon,
  PanelLeft,
  PanelLeftClose,
  Search,
  Sun,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import {
  DEFAULT_APPEARANCE,
  THEMES,
  fetchInterfaceSettings,
  resetInterfaceSettings,
  updateInterfaceSettings,
  type AppearanceSettings,
  type DisplayMode,
  type SidebarStyle,
  type ThemeId,
} from "@/lib/appearance";

const CHART = [
  { d: "T2", v: 72 },
  { d: "T3", v: 88 },
  { d: "T4", v: 64 },
  { d: "T5", v: 91 },
  { d: "T6", v: 78 },
  { d: "T7", v: 96 },
  { d: "CN", v: 54 },
];

const NEW_EMPLOYEES = [
  { name: "Nguyễn Văn Minh", role: "Phục vụ", avatar: "https://i.pravatar.cc/80?u=nv-minh" },
  { name: "Trần Thị Hoa", role: "Thu ngân", avatar: "https://i.pravatar.cc/80?u=tt-hoa" },
  { name: "Lê Quốc Huy", role: "Bếp chính", avatar: "https://i.pravatar.cc/80?u=lq-huy" },
];

function Toggle({
  on,
  onChange,
  rounded,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  rounded: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={clsx(
        "relative h-6 w-11 shrink-0",
        rounded ? "rounded-full" : "rounded-md",
        on ? "bg-indigo-500" : "bg-slate-200",
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 h-5 w-5 bg-white shadow-sm transition-all",
          rounded ? "rounded-full" : "rounded-sm",
          on ? "left-[22px]" : "left-0.5",
        )}
      />
    </button>
  );
}

function SelectCard({
  selected,
  onClick,
  children,
  rounded,
  primary,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  rounded: boolean;
  primary: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "relative flex-1 border p-4 text-left",
        rounded ? "rounded-2xl" : "rounded-md",
        selected ? "bg-white" : "border-slate-200 bg-white hover:bg-slate-50",
      )}
      style={
        selected
          ? { borderColor: primary, boxShadow: `0 0 0 3px ${primary}22` }
          : undefined
      }
    >
      {selected ? (
        <span
          className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center text-white"
          style={{
            background: primary,
            borderRadius: rounded ? 999 : 4,
          }}
        >
          <Check className="h-3 w-3" />
        </span>
      ) : null}
      {children}
    </button>
  );
}

function InterfacePreview({ settings }: { settings: AppearanceSettings }) {
  const dark = settings.mode === "dark";
  const r = settings.rounded ? "rounded-xl" : "rounded-md";
  const rSm = settings.rounded ? "rounded-lg" : "rounded-sm";
  const rFull = settings.rounded ? "rounded-full" : "rounded-md";
  const expanded = settings.sidebar === "expanded";
  const primary = settings.primary;

  return (
    <div
      className={clsx(
        "overflow-hidden border shadow-sm",
        r,
        dark ? "border-slate-700 bg-slate-900" : "border-slate-200 bg-white",
      )}
    >
      <div className="flex min-h-[420px]">
        <aside
          className={clsx(
            "shrink-0 border-r p-2",
            expanded ? "w-[72px]" : "w-10",
            dark
              ? "border-slate-700 bg-slate-950"
              : "border-slate-100 bg-slate-50",
          )}
        >
          <div
            className={clsx("mb-3 h-6 w-6", rSm)}
            style={{ background: primary }}
          />
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={clsx(
                "mb-1.5 h-6",
                rSm,
                i === 1
                  ? "opacity-100"
                  : dark
                    ? "bg-slate-800"
                    : "bg-slate-200",
              )}
              style={i === 1 ? { background: `${primary}33` } : undefined}
            />
          ))}
        </aside>
        <div className="min-w-0 flex-1 p-3">
          <div className="mb-3 flex items-center gap-2">
            <div
              className={clsx(
                "flex h-7 flex-1 items-center gap-1.5 px-2",
                rSm,
                dark ? "bg-slate-800" : "bg-slate-50",
              )}
            >
              <Search className="h-3 w-3 text-slate-400" />
              <span className="text-[9px] text-slate-400">Tìm kiếm...</span>
            </div>
            <Bell className="h-3.5 w-3.5 text-slate-400" />
            <span className={clsx("h-6 w-6 bg-slate-300", rFull)} />
          </div>

          <div className="mb-3 grid grid-cols-3 gap-2">
            {[
              { label: "Nhân viên", value: "128", delta: "+12%", icon: Users },
              { label: "Chấm công", value: "96%", delta: "+2.1%" },
              { label: "Tổng lương", value: "256.8M", delta: "+8%" },
            ].map((kpi) => (
              <div
                key={kpi.label}
                className={clsx(
                  "border p-2",
                  rSm,
                  dark
                    ? "border-slate-700 bg-slate-800"
                    : "border-slate-100 bg-white",
                )}
              >
                <p
                  className={clsx(
                    "text-[9px]",
                    dark ? "text-slate-400" : "text-slate-400",
                  )}
                >
                  {kpi.label}
                </p>
                <p
                  className={clsx(
                    "text-sm font-bold",
                    dark ? "text-white" : "text-slate-800",
                  )}
                >
                  {kpi.value}
                </p>
                <p className="flex items-center gap-0.5 text-[9px] font-medium text-emerald-500">
                  <TrendingUp className="h-2.5 w-2.5" />
                  {kpi.delta}
                </p>
              </div>
            ))}
          </div>

          <div
            className={clsx(
              "mb-3 border p-2",
              rSm,
              dark ? "border-slate-700 bg-slate-800" : "border-slate-100",
            )}
          >
            <p
              className={clsx(
                "mb-1 text-[10px] font-semibold",
                dark ? "text-slate-200" : "text-slate-700",
              )}
            >
              Bảng công theo ngày
            </p>
            <div className="h-[88px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CHART}>
                  <defs>
                    <linearGradient id="previewFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={primary} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={primary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <Tooltip
                    contentStyle={{
                      fontSize: 10,
                      borderRadius: 8,
                      padding: "4px 8px",
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="v"
                    stroke={primary}
                    strokeWidth={2}
                    fill="url(#previewFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <p
              className={clsx(
                "mb-1.5 text-[10px] font-semibold",
                dark ? "text-slate-200" : "text-slate-700",
              )}
            >
              Nhân viên mới
            </p>
            <div className="space-y-1.5">
              {NEW_EMPLOYEES.map((emp) => (
                <div key={emp.name} className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={emp.avatar}
                    alt=""
                    className={clsx("h-6 w-6 object-cover", rFull)}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={clsx(
                        "truncate text-[10px] font-semibold",
                        dark ? "text-slate-100" : "text-slate-800",
                      )}
                    >
                      {emp.name}
                    </p>
                    <p className="text-[9px] text-slate-400">{emp.role}</p>
                  </div>
                  <span
                    className={clsx(
                      "px-1.5 py-0.5 text-[8px] font-semibold text-emerald-600",
                      rFull,
                      dark ? "bg-emerald-500/15" : "bg-emerald-50",
                    )}
                  >
                    Mới
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SettingsInterfacePanel({
  onToast,
}: {
  onToast: (msg: string) => void;
}) {
  const [draft, setDraft] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [saved, setSaved] = useState<AppearanceSettings>(DEFAULT_APPEARANCE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    async function boot() {
      try {
        const settings = await fetchInterfaceSettings();
        if (!alive) return;
        setDraft(settings);
        setSaved(settings);
        setError(null);
      } catch (err) {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Không tải được giao diện.");
      } finally {
        if (alive) setLoading(false);
      }
    }
    void boot();
    return () => {
      alive = false;
    };
  }, []);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  function patch(partial: Partial<AppearanceSettings>) {
    setDraft((prev) => ({ ...prev, ...partial }));
  }

  function selectTheme(id: ThemeId) {
    const theme = THEMES.find((t) => t.id === id)!;
    patch({
      theme: id,
      primary: theme.primary,
      secondary: theme.secondary,
    });
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    try {
      const next = await updateInterfaceSettings(draft);
      setDraft(next);
      setSaved(next);
      onToast("Đã lưu giao diện");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu giao diện.");
    } finally {
      setSaving(false);
    }
  }

  async function onReset() {
    setSaving(true);
    setError(null);
    try {
      const next = await resetInterfaceSettings();
      setDraft(next);
      setSaved(next);
      onToast("Đã khôi phục giao diện mặc định");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể khôi phục.");
    } finally {
      setSaving(false);
    }
  }

  const r = draft.rounded ? "rounded-2xl" : "rounded-md";
  const rInput = draft.rounded ? "rounded-xl" : "rounded-md";

  return (
    <div className="flex flex-col gap-5 xl:flex-row">
      <section
        className={clsx(
          "min-w-0 flex-1 border border-slate-200 bg-white p-5 shadow-sm",
          r,
        )}
      >
        <div className="mb-5">
          <h3 className="text-base font-bold text-slate-800">Giao diện</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Tùy chỉnh giao diện hiển thị của hệ thống
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {error}
          </div>
        ) : null}

        {loading ? (
          <p className="py-16 text-center text-sm text-slate-400">Đang tải...</p>
        ) : (
          <div className="space-y-6">
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-800">
              1. Chủ đề màu sắc
            </p>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
              {THEMES.map((theme) => {
                const selected = draft.theme === theme.id;
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => selectTheme(theme.id)}
                    className={clsx(
                      "border bg-white p-2.5 text-center",
                      rInput,
                      selected
                        ? "shadow-sm"
                        : "border-slate-200 hover:bg-slate-50",
                    )}
                    style={
                      selected
                        ? {
                            borderColor: theme.primary,
                            boxShadow: `0 0 0 3px ${theme.primary}22`,
                          }
                        : undefined
                    }
                  >
                    <span
                      className={clsx("mx-auto block h-8 w-8", rInput)}
                      style={{ background: theme.primary }}
                    />
                    <span className="mt-1.5 block text-[11px] font-medium text-slate-600">
                      {theme.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Màu chủ đạo
                </span>
                <div
                  className={clsx(
                    "flex items-center gap-2 border border-slate-200 px-3 py-2",
                    rInput,
                  )}
                >
                  <input
                    type="color"
                    value={draft.primary}
                    onChange={(e) => patch({ primary: e.target.value })}
                    className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
                  />
                  <input
                    value={draft.primary}
                    onChange={(e) => patch({ primary: e.target.value })}
                    className="w-full bg-transparent text-sm text-slate-700 outline-none uppercase"
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  Màu phụ
                </span>
                <div
                  className={clsx(
                    "flex items-center gap-2 border border-slate-200 px-3 py-2",
                    rInput,
                  )}
                >
                  <input
                    type="color"
                    value={draft.secondary}
                    onChange={(e) => patch({ secondary: e.target.value })}
                    className="h-6 w-6 cursor-pointer border-0 bg-transparent p-0"
                  />
                  <input
                    value={draft.secondary}
                    onChange={(e) => patch({ secondary: e.target.value })}
                    className="w-full bg-transparent text-sm text-slate-700 outline-none uppercase"
                  />
                </div>
              </label>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-slate-800">
              2. Chế độ hiển thị
            </p>
            <div className="flex gap-3">
              <SelectCard
                selected={draft.mode === "light"}
                onClick={() => patch({ mode: "light" as DisplayMode })}
                rounded={draft.rounded}
                primary={draft.primary}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-500">
                  <Sun className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-800">Sáng</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Giao diện sáng, dễ nhìn ban ngày
                </p>
              </SelectCard>
              <SelectCard
                selected={draft.mode === "dark"}
                onClick={() => patch({ mode: "dark" as DisplayMode })}
                rounded={draft.rounded}
                primary={draft.primary}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-100">
                  <Moon className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-800">Tối</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Giao diện tối, dễ nhìn ban đêm
                </p>
              </SelectCard>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-slate-800">
              3. Kiểu sidebar
            </p>
            <div className="flex gap-3">
              <SelectCard
                selected={draft.sidebar === "expanded"}
                onClick={() => patch({ sidebar: "expanded" as SidebarStyle })}
                rounded={draft.rounded}
                primary={draft.primary}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
                  <PanelLeft className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-800">
                  Mở rộng
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Hiện đầy đủ tên mục điều hướng
                </p>
              </SelectCard>
              <SelectCard
                selected={draft.sidebar === "collapsed"}
                onClick={() => patch({ sidebar: "collapsed" as SidebarStyle })}
                rounded={draft.rounded}
                primary={draft.primary}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <PanelLeftClose className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-800">
                  Thu gọn
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Chỉ hiện icon, tiết kiệm không gian
                </p>
              </SelectCard>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-slate-800">4. Khác</p>
            <div
              className={clsx("divide-y divide-slate-100 border border-slate-200", rInput)}
            >
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">Bo tròn góc</p>
                  <p className="text-xs text-slate-400">
                    Bo góc thẻ, nút và bảng
                  </p>
                </div>
                <Toggle
                  on={draft.rounded}
                  onChange={(v) => patch({ rounded: v })}
                  rounded={draft.rounded}
                />
              </div>
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    Hiệu ứng chuyển động
                  </p>
                  <p className="text-xs text-slate-400">
                    Animation khi chuyển trang và hover
                  </p>
                </div>
                <Toggle
                  on={draft.animation}
                  onChange={(v) => patch({ animation: v })}
                  rounded={draft.rounded}
                />
              </div>
            </div>
          </div>
        </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setDraft(saved)}
            className={clsx(
              "border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600",
              rInput,
            )}
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={saving || !dirty}
            onClick={() => void onSave()}
            className={clsx(
              "px-4 py-2 text-sm font-semibold text-white disabled:opacity-50",
              rInput,
            )}
            style={{ background: draft.primary }}
          >
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </section>

      <aside className="w-full shrink-0 xl:w-[340px]">
        <section
          className={clsx("border border-slate-200 bg-white p-5 shadow-sm", r)}
        >
          <h3 className="font-semibold text-slate-800">Xem trước giao diện</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Xem trước các thay đổi của bạn
          </p>
          <div className="mt-4">
            <InterfacePreview settings={draft} />
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={() => void onReset()}
            className="mt-4 w-full text-center text-sm font-medium text-slate-500 hover:text-indigo-600 disabled:opacity-50"
          >
            Khôi phục mặc định
          </button>
        </section>
      </aside>
    </div>
  );
}
