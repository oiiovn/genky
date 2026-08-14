"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  FileText,
  Globe,
  HardDrive,
  Languages,
  Mail,
  MapPin,
  MemoryStick,
  Phone,
  ScrollText,
  Server,
  Shield,
  Users,
  X,
} from "lucide-react";
import {
  fetchOrganizationLogoSrc,
  type AuthOrganization,
  type Branch,
} from "@/lib/api";
import {
  CURRENCY_OPTIONS,
  DATE_FORMAT_OPTIONS,
  DEFAULT_GENERAL,
  LANGUAGE_OPTIONS,
  WEEK_START_OPTIONS,
  createGeneralBackup,
  fetchGeneralOverview,
  labelCurrency,
  labelDateFormat,
  labelLanguage,
  labelWeekStart,
  labelWorkHours,
  updateGeneralSettings,
  type GeneralOverview,
  type GeneralSettings,
} from "@/lib/general-settings";
import { settingsPath } from "@/lib/settings";

function QuickEditModal({
  draft,
  saving,
  error,
  onChange,
  onClose,
  onSave,
}: {
  draft: GeneralSettings;
  saving: boolean;
  error: string | null;
  onChange: (next: GeneralSettings) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const fieldClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-400";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800">Cài đặt nhanh</h3>
            <p className="text-sm text-slate-500">
              Áp dụng cho toàn bộ tổ chức
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Giờ làm việc tiêu chuẩn
            </span>
            <select
              className={fieldClass}
              value={draft.work_hours_per_day}
              onChange={(e) =>
                onChange({
                  ...draft,
                  work_hours_per_day: Number(e.target.value),
                })
              }
            >
              {[4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                <option key={h} value={h}>
                  {h} giờ/ngày
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Ngày bắt đầu tuần
            </span>
            <select
              className={fieldClass}
              value={draft.week_start}
              onChange={(e) =>
                onChange({
                  ...draft,
                  week_start: e.target.value as GeneralSettings["week_start"],
                })
              }
            >
              {WEEK_START_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Định dạng ngày
            </span>
            <select
              className={fieldClass}
              value={draft.date_format}
              onChange={(e) =>
                onChange({
                  ...draft,
                  date_format: e.target.value as GeneralSettings["date_format"],
                })
              }
            >
              {DATE_FORMAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Đơn vị tiền tệ
            </span>
            <select
              className={fieldClass}
              value={draft.currency}
              onChange={(e) =>
                onChange({
                  ...draft,
                  currency: e.target.value as GeneralSettings["currency"],
                })
              }
            >
              {CURRENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700">
              Ngôn ngữ
            </span>
            <select
              className={fieldClass}
              value={draft.language}
              onChange={(e) =>
                onChange({
                  ...draft,
                  language: e.target.value as GeneralSettings["language"],
                })
              }
            >
              {LANGUAGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {error ? (
          <p className="mt-3 text-sm text-rose-600">{error}</p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsGeneralPanel({
  organization,
  branches,
  onToast,
}: {
  organization: AuthOrganization | null;
  branches: Branch[];
  onToast: (msg: string) => void;
}) {
  const [overview, setOverview] = useState<GeneralOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<GeneralSettings>(DEFAULT_GENERAL);
  const [saving, setSaving] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await fetchGeneralOverview();
        if (cancelled) return;
        setOverview(data);
        setDraft(data.general);
      } catch (err) {
        if (!cancelled) {
          onToast(
            err instanceof Error ? err.message : "Không tải được cài đặt chung.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [onToast]);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    async function loadLogo() {
      if (!organization?.logo_url && !overview?.company.has_logo) {
        setLogoSrc(null);
        return;
      }
      const src = await fetchOrganizationLogoSrc();
      if (cancelled) {
        if (src) URL.revokeObjectURL(src);
        return;
      }
      objectUrl = src;
      setLogoSrc(src);
    }
    void loadLogo();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [organization?.logo_url, overview?.company.has_logo]);

  const modules = [
    {
      id: "company" as const,
      title: "Thông tin công ty",
      desc: "Tên, MST, địa chỉ và liên hệ",
      icon: Building2,
      tone: "bg-violet-50 text-violet-500",
    },
    {
      id: "branches" as const,
      title: "Chi nhánh",
      desc: `${branches.length} chi nhánh đang hoạt động`,
      icon: MapPin,
      tone: "bg-sky-50 text-sky-500",
    },
    {
      id: "security" as const,
      title: "Tài khoản & Bảo mật",
      desc: "Mật khẩu, phiên đăng nhập",
      icon: Shield,
      tone: "bg-amber-50 text-amber-500",
    },
    {
      id: "activity" as const,
      title: "Nhật ký hệ thống",
      desc: "Theo dõi thao tác và sự kiện",
      icon: ScrollText,
      tone: "bg-emerald-50 text-emerald-500",
    },
  ];

  const general = overview?.general ?? DEFAULT_GENERAL;
  const company = overview?.company;
  const companyName =
    company?.name || organization?.name || "—";

  const quick = useMemo(
    () => [
      {
        label: "Giờ làm việc tiêu chuẩn",
        value: labelWorkHours(general.work_hours_per_day),
        icon: Clock3,
      },
      {
        label: "Ngày bắt đầu tuần",
        value: labelWeekStart(general.week_start),
        icon: CalendarDays,
      },
      {
        label: "Định dạng ngày",
        value: labelDateFormat(general.date_format),
        icon: CalendarDays,
      },
      {
        label: "Đơn vị tiền tệ",
        value: labelCurrency(general.currency),
        icon: Globe,
      },
      {
        label: "Ngôn ngữ",
        value: labelLanguage(general.language),
        icon: Languages,
      },
    ],
    [general],
  );

  const companyFields = [
    { label: "Tên công ty", value: companyName, icon: Building2 },
    {
      label: "Mã số thuế",
      value: company?.tax_code || organization?.tax_code || "—",
      icon: FileText,
    },
    {
      label: "Địa chỉ",
      value:
        company?.address ||
        organization?.address ||
        branches[0]?.address ||
        "Chưa cập nhật",
      icon: MapPin,
    },
    {
      label: "Điện thoại",
      value: company?.phone || organization?.phone || "—",
      icon: Phone,
    },
    {
      label: "Email",
      value: company?.email || organization?.email || "—",
      icon: Mail,
    },
    {
      label: "Website",
      value: company?.website || organization?.website || "—",
      icon: Globe,
    },
  ];

  const statusItems = overview
    ? [
        { label: "Server", value: overview.system.server.label, ok: overview.system.server.ok },
        {
          label: "Database",
          value: overview.system.database.label,
          ok: overview.system.database.ok,
        },
        {
          label: "Bộ nhớ",
          value: overview.system.memory.label,
          ok: overview.system.memory.ok,
        },
        {
          label: "Dung lượng đĩa",
          value: overview.system.disk.label,
          ok: overview.system.disk.ok,
        },
      ]
    : [];

  const userStats = overview
    ? [
        { label: "Tổng", value: overview.users.total },
        { label: "Đang hoạt động", value: overview.users.active },
        { label: "Bị khoá", value: overview.users.locked },
        { label: "Chưa xác minh", value: overview.users.unverified },
      ]
    : [];

  async function saveQuick() {
    setSaving(true);
    setError(null);
    try {
      const next = await updateGeneralSettings(draft);
      setOverview((prev) => (prev ? { ...prev, general: next } : prev));
      setEditing(false);
      onToast("Đã lưu cài đặt nhanh");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được.");
    } finally {
      setSaving(false);
    }
  }

  async function onBackup() {
    if (!overview?.can_manage) {
      onToast("Bạn không có quyền sao lưu.");
      return;
    }
    setBackingUp(true);
    try {
      const backup = await createGeneralBackup();
      setOverview((prev) => (prev ? { ...prev, backup } : prev));
      onToast("Đã tạo bản sao lưu");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Không sao lưu được.");
    } finally {
      setBackingUp(false);
    }
  }

  if (loading && !overview) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500 shadow-sm">
        Đang tải cài đặt chung...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold text-slate-800">Cài đặt chung</h3>
            <p className="text-sm text-slate-500">
              Các nhóm cấu hình dùng nhiều nhất
            </p>
          </div>
          <Link
            href={settingsPath("company")}
            className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
          >
            Xem tất cả
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <Link
                key={m.id}
                href={settingsPath(m.id)}
                className="rounded-xl border border-slate-200 p-4 text-left transition hover:border-indigo-200 hover:bg-indigo-50/30"
              >
                <div
                  className={clsx(
                    "mb-3 flex h-11 w-11 items-center justify-center rounded-xl",
                    m.tone,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <p className="font-semibold text-slate-800">{m.title}</p>
                <p className="mt-1 text-xs text-slate-500">{m.desc}</p>
                <span className="mt-3 inline-flex text-sm font-semibold text-indigo-600">
                  Cài đặt
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800">Cài đặt nhanh</h3>
          <ul className="mt-4 divide-y divide-slate-100">
            {quick.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!overview?.can_manage) {
                        onToast("Bạn không có quyền chỉnh sửa.");
                        return;
                      }
                      setDraft(general);
                      setError(null);
                      setEditing(true);
                    }}
                    className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50/80"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-slate-500">
                        {item.label}
                      </span>
                      <span className="block text-sm font-semibold text-slate-800">
                        {item.value}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </button>
                </li>
              );
            })}
          </ul>
          <Link
            href={settingsPath("appearance")}
            className="mt-2 inline-block text-sm font-semibold text-indigo-600"
          >
            Xem tất cả cài đặt chung
          </Link>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Thông tin công ty</h3>
            <Link
              href={settingsPath("company")}
              className="text-sm font-semibold text-indigo-600"
            >
              Chỉnh sửa
            </Link>
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            {logoSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoSrc}
                alt=""
                className="h-28 w-28 shrink-0 rounded-2xl object-cover shadow-md shadow-indigo-200"
              />
            ) : (
              <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 p-3 text-center text-xs font-bold text-white shadow-md shadow-indigo-200">
                {companyName}
              </div>
            )}
            <ul className="min-w-0 flex-1 space-y-2.5">
              {companyFields.map((f) => {
                const Icon = f.icon;
                return (
                  <li key={f.label} className="flex items-start gap-2.5 text-sm">
                    <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0">
                      <span className="block text-xs text-slate-400">
                        {f.label}
                      </span>
                      <span className="block truncate font-medium text-slate-800">
                        {f.value}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
              <Database className="h-4 w-4" />
            </span>
            <h3 className="font-semibold text-slate-800">Sao lưu dữ liệu</h3>
          </div>
          <p className="text-xs text-slate-500">Lần sao lưu gần nhất</p>
          <p className="mt-1 text-sm font-semibold text-slate-800">
            {overview?.backup.last_label || "Chưa sao lưu"}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Dung lượng: {overview?.backup.size_label || "—"}
          </p>
          <button
            type="button"
            disabled={backingUp}
            onClick={() => void onBackup()}
            className="mt-4 w-full rounded-xl bg-indigo-500 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {backingUp ? "Đang sao lưu..." : "Sao lưu ngay"}
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
              <Server className="h-4 w-4" />
            </span>
            <h3 className="font-semibold text-slate-800">Trạng thái hệ thống</h3>
          </div>
          <ul className="space-y-2.5">
            {statusItems.map((s) => (
              <li
                key={s.label}
                className="flex items-center justify-between text-sm"
              >
                <span className="flex items-center gap-2 text-slate-600">
                  <span
                    className={clsx(
                      "h-2 w-2 rounded-full",
                      s.ok ? "bg-emerald-500" : "bg-amber-400",
                    )}
                  />
                  {s.label}
                </span>
                <span className="font-medium text-slate-800">{s.value}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-3 text-slate-400">
            <MemoryStick className="h-4 w-4" />
            <HardDrive className="h-4 w-4" />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-50 text-sky-500">
              <Users className="h-4 w-4" />
            </span>
            <h3 className="font-semibold text-slate-800">Người dùng hệ thống</h3>
          </div>
          <ul className="space-y-2.5">
            {userStats.map((u) => (
              <li
                key={u.label}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-slate-500">{u.label}</span>
                <span className="font-semibold text-slate-800">{u.value}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <h3 className="font-semibold text-slate-800">Phiên bản hệ thống</h3>
          </div>
          <p className="text-lg font-bold text-slate-800">
            {overview?.version.label || "HRM Pro v2.1.0"}
          </p>
          {overview?.version.latest ? (
            <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
              Mới nhất
            </span>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">
            Cập nhật: {overview?.version.released_label || "—"}
          </p>
          <p className="text-xs text-slate-400">
            Nhà phát triển: {overview?.version.developer || "Genky"}
          </p>
          <button
            type="button"
            onClick={() =>
              onToast(
                overview?.version.latest
                  ? "Bạn đang dùng bản mới nhất"
                  : "Có bản cập nhật mới",
              )
            }
            className="mt-4 w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Kiểm tra cập nhật
          </button>
        </section>
      </div>

      {editing ? (
        <QuickEditModal
          draft={draft}
          saving={saving}
          error={error}
          onChange={setDraft}
          onClose={() => setEditing(false)}
          onSave={() => void saveQuick()}
        />
      ) : null}
    </div>
  );
}
