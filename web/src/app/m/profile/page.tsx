"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  CalendarDays,
  Camera,
  ChevronRight,
  Home,
  IdCard,
  Mail,
  Pencil,
  Phone,
  Settings,
  Shield,
  Store,
  UserRound,
  VenusAndMars,
  X,
} from "lucide-react";
import { useStaff } from "@/components/staff/StaffShell";
import {
  changePassword,
  fetchUserAvatarSrc,
  uploadAvatar,
} from "@/lib/api";
import {
  fetchStaffProfile,
  updateStaffProfile,
  type StaffProfileResponse,
  type StaffProfileUpdate,
} from "@/lib/staff-profile-api";
import { employeeAvatarSrc } from "@/lib/avatar";

const genderLabel: Record<string, string> = {
  male: "Nam",
  female: "Nữ",
  other: "Khác",
};

function formatDateVi(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function toInputDate(iso: string | null | undefined): string {
  return iso?.slice(0, 10) ?? "";
}

type EditField =
  | "full_name"
  | "date_of_birth"
  | "gender"
  | "address"
  | "identity_number"
  | "phone"
  | null;

type EditTarget = EditField | "account";

export default function StaffProfilePage() {
  const { session, refresh, logout } = useStaff();
  const fileRef = useRef<HTMLInputElement>(null);
  const [profile, setProfile] = useState<StaffProfileResponse | null>(null);
  const [avatarSrc, setAvatarSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditTarget>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);

  const emp = profile?.employee;
  const primaryBranch =
    emp?.branches.find((b) => b.is_primary)?.name ??
    emp?.branches[0]?.name ??
    session.branches.find((b) => b.is_primary)?.name ??
    session.branches[0]?.name ??
    "—";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [next, src] = await Promise.all([
        fetchStaffProfile(),
        fetchUserAvatarSrc().catch(() => null),
      ]);
      setProfile(next);
      setAvatarSrc((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return src ?? next.employee.avatar ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không tải được hồ sơ.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  const displayName = emp?.full_name ?? session.fullName;
  const displayCode = emp?.employee_code ?? session.employeeCode;
  const phone = emp?.phone ?? session.me.user.phone;
  const email = emp?.email ?? session.me.user.email;
  const roleName =
    emp?.role?.name ?? emp?.position?.name ?? profile?.role_label ?? "Nhân viên";

  const personalRows = useMemo(
    () => [
      {
        key: "full_name" as const,
        label: "Họ và tên",
        value: displayName,
        Icon: UserRound,
        iconClass: "bg-sky-500/15 text-sky-400",
      },
      {
        key: "date_of_birth" as const,
        label: "Ngày sinh",
        value: formatDateVi(emp?.date_of_birth),
        Icon: CalendarDays,
        iconClass: "bg-orange-500/15 text-orange-400",
      },
      {
        key: "gender" as const,
        label: "Giới tính",
        value: emp?.gender ? genderLabel[emp.gender] ?? emp.gender : "—",
        Icon: VenusAndMars,
        iconClass: "bg-violet-500/15 text-violet-400",
      },
      {
        key: "address" as const,
        label: "Địa chỉ",
        value: emp?.address || "—",
        Icon: Home,
        iconClass: "bg-emerald-500/15 text-emerald-400",
        wrap: true,
      },
      {
        key: "identity_number" as const,
        label: "CMND/CCCD",
        value: emp?.identity_number || "—",
        Icon: IdCard,
        iconClass: "bg-teal-500/15 text-teal-400",
      },
    ],
    [displayName, emp],
  );

  function openEdit(field: EditField) {
    if (!field || !emp) return;
    if (field === "date_of_birth") setDraft(toInputDate(emp.date_of_birth));
    else if (field === "gender") setDraft(emp.gender ?? "");
    else if (field === "full_name") setDraft(emp.full_name);
    else if (field === "address") setDraft(emp.address ?? "");
    else if (field === "identity_number") setDraft(emp.identity_number ?? "");
    else if (field === "phone") setDraft(emp.phone ?? "");
    setEdit(field);
  }

  async function saveEdit() {
    if (!edit || edit === "account") return;
    setSaving(true);
    try {
      const payload: StaffProfileUpdate = {};
      if (edit === "full_name") payload.full_name = draft.trim();
      if (edit === "phone") payload.phone = draft.trim() || null;
      if (edit === "address") payload.address = draft.trim() || null;
      if (edit === "identity_number")
        payload.identity_number = draft.trim() || null;
      if (edit === "date_of_birth")
        payload.date_of_birth = draft.trim() || null;
      if (edit === "gender") {
        payload.gender =
          draft === "male" || draft === "female" || draft === "other"
            ? draft
            : null;
      }
      const next = await updateStaffProfile(payload);
      setProfile(next);
      await refresh();
      setEdit(null);
      setToast("Đã cập nhật hồ sơ");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Không lưu được.");
    } finally {
      setSaving(false);
    }
  }

  async function onAvatar(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      setToast("Ảnh đại diện tối đa 8MB.");
      return;
    }
    setUploading(true);
    try {
      await uploadAvatar(file);
      await refresh();
      await load();
      setToast("Đã cập nhật ảnh đại diện");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Không tải được ảnh.");
    } finally {
      setUploading(false);
    }
  }

  async function submitPassword() {
    if (newPw !== confirmPw) {
      setToast("Xác nhận mật khẩu không khớp.");
      return;
    }
    setPwBusy(true);
    try {
      await changePassword({
        current_password: currentPw,
        password: newPw,
        password_confirmation: confirmPw,
      });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setToast("Đã đổi mật khẩu");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Không đổi được mật khẩu.");
    } finally {
      setPwBusy(false);
    }
  }

  async function handleLogout() {
    if (logoutBusy) return;
    if (!window.confirm("Đăng xuất khỏi thiết bị này?")) return;
    setLogoutBusy(true);
    try {
      await logout();
    } finally {
      setLogoutBusy(false);
    }
  }

  const photo = employeeAvatarSrc({
    avatar: avatarSrc || emp?.avatar,
    name: displayName,
    code: displayCode,
  });

  return (
    <div className="px-4 pt-4 pb-6">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-tight text-white">
          Hồ sơ cá nhân
        </h1>
        <button
          type="button"
          onClick={() => setEdit("account")}
          className="flex h-9 w-9 items-center justify-center text-slate-300"
          aria-label="Cài đặt tài khoản"
        >
          <Settings className="h-5 w-5" strokeWidth={1.75} />
        </button>
      </div>

      {toast ? (
        <div className="mb-3 rounded-2xl border border-sky-400/30 bg-sky-500/15 px-3 py-2 text-sm text-sky-100">
          {toast}
        </div>
      ) : null}

      {loading && !profile ? (
        <div className="rounded-2xl border border-white/10 bg-[#1A2233] px-4 py-16 text-center text-sm text-slate-400">
          Đang tải hồ sơ...
        </div>
      ) : null}

      {error && !profile ? (
        <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-8 text-center">
          <p className="text-sm text-rose-200">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-full bg-white/10 px-4 py-2 text-sm text-white"
          >
            Thử lại
          </button>
        </div>
      ) : null}

      {profile && emp ? (
        <div className="space-y-3.5">
          {/* Hero card */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#1A2233] p-4">
            <div className="flex gap-3.5">
              <div className="relative shrink-0 self-start">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo}
                  alt={displayName}
                  className="h-16 w-16 rounded-full object-cover"
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (file) void onAvatar(file);
                  }}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                  className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full bg-[#3B82F6] text-white shadow-md disabled:opacity-60"
                  aria-label="Tải ảnh đại diện"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <h2 className="truncate text-[17px] font-semibold text-white">
                    {displayName}
                  </h2>
                  <button
                    type="button"
                    onClick={() => openEdit("full_name")}
                    className="shrink-0 text-[#60A5FA]"
                    aria-label="Sửa tên"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-1.5 flex items-center gap-2">
                  <span className="rounded-md bg-[#3B82F6] px-2 py-[2px] text-[11px] font-semibold text-white">
                    Nhân viên
                  </span>
                  <span className="text-[12px] text-slate-400">
                    ID: {displayCode}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openEdit("phone")}
                  className="mt-2.5 flex w-full items-center gap-2 text-[13px] text-slate-300"
                >
                  <Phone className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">
                    {phone || "Thêm số điện thoại"}
                  </span>
                </button>
                <div className="mt-1.5 flex items-center gap-2 text-[13px] text-slate-300">
                  <Mail className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                  <span className="truncate">{email || "—"}</span>
                </div>
              </div>
            </div>

            <div className="mt-3.5 grid grid-cols-2 gap-3 border-t border-white/[0.08] pt-3.5">
              <div className="flex items-start gap-2">
                <Store className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="text-[11px] leading-none text-slate-500">
                    Chi nhánh
                  </p>
                  <p className="mt-1 truncate text-[13px] font-medium text-white">
                    {primaryBranch}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                <div className="min-w-0">
                  <p className="text-[11px] leading-none text-slate-500">
                    Ngày vào làm
                  </p>
                  <p className="mt-1 text-[13px] font-medium text-white">
                    {formatDateVi(emp.joined_at)}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Personal info — label left, value right */}
          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1A2233]">
            <div className="px-4 py-3">
              <h3 className="text-[15px] font-semibold text-white">
                Thông tin cá nhân
              </h3>
            </div>
            <div>
              {personalRows.map((row, idx) => {
                const Icon = row.Icon;
                return (
                  <button
                    key={row.key}
                    type="button"
                    onClick={() => openEdit(row.key)}
                    className={clsx(
                      "flex w-full items-center gap-3 px-4 py-3.5 text-left",
                      idx > 0 && "border-t border-white/[0.06]",
                    )}
                  >
                    <span
                      className={clsx(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                        row.iconClass,
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="shrink-0 text-[14px] text-slate-300">
                      {row.label}
                    </span>
                    <span
                      className={clsx(
                        "min-w-0 flex-1 text-right text-[14px] font-medium text-white",
                        row.wrap ? "line-clamp-2" : "truncate",
                      )}
                    >
                      {row.value}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setEdit("account")}
                className="flex w-full items-center gap-3 border-t border-white/[0.06] px-4 py-3.5 text-left"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
                  <Shield className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14px] text-slate-300">
                    Thông tin tài khoản
                  </span>
                  <span className="mt-0.5 block text-[12px] text-slate-500">
                    Đổi mật khẩu, đăng xuất thiết bị
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
              </button>
            </div>
          </section>

          {/* Role */}
          <section>
            <h3 className="mb-2 px-0.5 text-[15px] font-semibold text-white">
              Vai trò &amp; Quyền hạn
            </h3>
            <Link
              href="/m/more"
              className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#1A2233] px-4 py-3.5"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-500/15 text-sky-400">
                <Shield className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-white">
                  {roleName}
                </span>
                <span className="mt-0.5 block text-[12px] text-slate-400">
                  Xem chi tiết quyền hạn
                </span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-slate-500" />
            </Link>
          </section>
        </div>
      ) : null}

      {edit && edit !== "account" ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1A2233] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-semibold text-white">
                {personalRows.find((r) => r.key === edit)?.label ??
                  (edit === "phone" ? "Số điện thoại" : "Cập nhật")}
              </h4>
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="rounded-lg p-1 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {edit === "gender" ? (
              <select
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0B1220] px-3 py-3 text-sm text-white outline-none"
              >
                <option value="">Chọn giới tính</option>
                <option value="female">Nữ</option>
                <option value="male">Nam</option>
                <option value="other">Khác</option>
              </select>
            ) : edit === "date_of_birth" ? (
              <input
                type="date"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0B1220] px-3 py-3 text-sm text-white outline-none"
              />
            ) : edit === "address" ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-white/10 bg-[#0B1220] px-3 py-3 text-sm text-white outline-none"
              />
            ) : (
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0B1220] px-3 py-3 text-sm text-white outline-none"
              />
            )}

            <button
              type="button"
              disabled={saving}
              onClick={() => void saveEdit()}
              className="mt-4 w-full rounded-2xl bg-[#3B82F6] py-3 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </div>
      ) : null}

      {edit === "account" ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-3 sm:items-center">
          <div className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/10 bg-[#1A2233] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="font-semibold text-white">Thông tin tài khoản</h4>
              <button
                type="button"
                onClick={() => setEdit(null)}
                className="rounded-lg p-1 text-slate-400"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <input
                type="password"
                placeholder="Mật khẩu hiện tại"
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0B1220] px-3 py-3 text-sm text-white outline-none"
              />
              <input
                type="password"
                placeholder="Mật khẩu mới"
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0B1220] px-3 py-3 text-sm text-white outline-none"
              />
              <input
                type="password"
                placeholder="Xác nhận mật khẩu mới"
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#0B1220] px-3 py-3 text-sm text-white outline-none"
              />
              <button
                type="button"
                disabled={pwBusy || !currentPw || !newPw}
                onClick={() => void submitPassword()}
                className="w-full rounded-2xl bg-[#3B82F6] py-3 text-sm font-semibold text-white disabled:opacity-60"
              >
                {pwBusy ? "Đang đổi..." : "Đổi mật khẩu"}
              </button>
              <button
                type="button"
                disabled={logoutBusy}
                onClick={() => void handleLogout()}
                className="w-full rounded-2xl border border-rose-400/30 bg-rose-500/10 py-3 text-sm font-semibold text-rose-200 disabled:opacity-60"
              >
                {logoutBusy ? "Đang đăng xuất..." : "Đăng xuất thiết bị"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
