"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import {
  Camera,
  Check,
  Eye,
  EyeOff,
  Laptop,
  ShieldCheck,
  Smartphone,
  Tablet,
} from "lucide-react";
import {
  changePassword,
  fetchLoginHistory,
  fetchSessions,
  logout as apiLogout,
  logoutAllDevices,
  logoutOtherDevices,
  updateProfile,
  uploadAvatar,
  type AuthSession,
  type AuthUser,
  type LoginHistoryRow,
} from "@/lib/api";
import { useRouter } from "next/navigation";
import { UserAvatar } from "@/components/dashboard/UserAvatar";

const TWO_FA_KEY = "genky_2fa_enabled";

function passwordChecks(value: string) {
  return [
    { ok: value.length >= 8, label: "Ít nhất 8 ký tự" },
    { ok: /[A-Z]/.test(value) && /[a-z]/.test(value), label: "Chữ hoa và chữ thường" },
    { ok: /\d/.test(value), label: "Có số" },
    { ok: /[^A-Za-z0-9]/.test(value), label: "Ký tự đặc biệt" },
  ];
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-400";

export function SettingsSecurityPanel({
  user,
  onUserChange,
  onToast,
}: {
  user: AuthUser;
  onUserChange: (user: AuthUser) => void;
  onToast: (msg: string) => void;
}) {
  const router = useRouter();
  const avatarRef = useRef<HTMLInputElement>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [show, setShow] = useState({ a: false, b: false, c: false });
  const [savingPw, setSavingPw] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);

  const [twoFa, setTwoFa] = useState(() => {
    if (typeof window === "undefined") return true;
    return localStorage.getItem(TWO_FA_KEY) !== "0";
  });

  const [devices, setDevices] = useState<AuthSession[]>([]);
  const [history, setHistory] = useState<LoginHistoryRow[]>([]);
  const [historyLimit, setHistoryLimit] = useState(5);

  const checks = useMemo(() => passwordChecks(newPw), [newPw]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [sessionRows, hist] = await Promise.all([
          fetchSessions(),
          fetchLoginHistory(historyLimit),
        ]);
        if (cancelled) return;
        setDevices(sessionRows);
        setHistory(hist.data);
      } catch (err) {
        if (!cancelled) {
          onToast(
            err instanceof Error ? err.message : "Không tải được dữ liệu bảo mật.",
          );
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [historyLimit, onToast]);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const next = await updateProfile({ name: name.trim(), phone: phone.trim() || null });
      onUserChange(next);
      setEditing(false);
      onToast("Đã cập nhật thông tin tài khoản");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Không thể lưu.");
    } finally {
      setSavingProfile(false);
    }
  }

  async function onAvatarChange(file: File) {
    if (file.size > 8 * 1024 * 1024) {
      onToast("Ảnh đại diện tối đa 8MB.");
      return;
    }
    setUploadingAvatar(true);
    try {
      const next = await uploadAvatar(file);
      onUserChange(next);
      onToast("Đã cập nhật ảnh đại diện");
    } catch (err) {
      onToast(err instanceof Error ? err.message : "Không tải được ảnh.");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (newPw !== confirmPw) {
      setPwError("Xác nhận mật khẩu không khớp.");
      return;
    }
    if (checks.some((c) => !c.ok)) {
      setPwError("Mật khẩu mới chưa đủ mạnh.");
      return;
    }
    setSavingPw(true);
    try {
      await changePassword({
        current_password: currentPw,
        password: newPw,
        password_confirmation: confirmPw,
      });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      onToast("Đã đổi mật khẩu");
    } catch (err) {
      setPwError(err instanceof Error ? err.message : "Không thể đổi mật khẩu.");
    } finally {
      setSavingPw(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 xl:flex-row">
      <div className="min-w-0 flex-1 space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800">Thông tin tài khoản</h3>
          <div className="mt-4 flex items-center gap-4">
            <div className="relative">
              <UserAvatar name={user.name} className="h-16 w-16 rounded-full" />
              <input
                ref={avatarRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void onAvatarChange(file);
                }}
              />
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => avatarRef.current?.click()}
                className="absolute -right-1 -bottom-1 flex h-7 w-7 items-center justify-center rounded-full border border-white bg-indigo-500 text-white disabled:opacity-60"
                aria-label="Tải ảnh đại diện"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            </div>
            <div>
              <p className="font-semibold text-slate-800">{user.name}</p>
              <p className="text-sm text-slate-500">{user.email}</p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block text-sm font-medium text-slate-700">
              Họ và tên
              <input
                disabled={!editing}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`mt-1 ${inputClass} disabled:bg-slate-50`}
              />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              Email
              <input disabled value={user.email} className={`mt-1 ${inputClass} disabled:bg-slate-50`} />
            </label>
            <label className="block text-sm font-medium text-slate-700 sm:col-span-2">
              Số điện thoại
              <input
                disabled={!editing}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`mt-1 ${inputClass} disabled:bg-slate-50`}
              />
            </label>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setName(user.name);
                    setPhone(user.phone ?? "");
                    setEditing(false);
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={savingProfile}
                  onClick={() => void saveProfile()}
                  className="rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Lưu
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-600"
              >
                Chỉnh sửa thông tin
              </button>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800">Đổi mật khẩu</h3>
          <form onSubmit={submitPassword} className="mt-4 space-y-3">
            <PasswordField
              label="Mật khẩu hiện tại"
              value={currentPw}
              show={show.a}
              onToggle={() => setShow((s) => ({ ...s, a: !s.a }))}
              onChange={setCurrentPw}
            />
            <PasswordField
              label="Mật khẩu mới"
              value={newPw}
              show={show.b}
              onToggle={() => setShow((s) => ({ ...s, b: !s.b }))}
              onChange={setNewPw}
            />
            <PasswordField
              label="Xác nhận mật khẩu mới"
              value={confirmPw}
              show={show.c}
              onToggle={() => setShow((s) => ({ ...s, c: !s.c }))}
              onChange={setConfirmPw}
            />
            <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {checks.map((c) => (
                <li
                  key={c.label}
                  className={clsx(
                    "flex items-center gap-1.5 text-xs",
                    c.ok ? "text-emerald-600" : "text-slate-400",
                  )}
                >
                  <Check className="h-3.5 w-3.5" />
                  {c.label}
                </li>
              ))}
            </ul>
            {pwError ? (
              <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                {pwError}
              </p>
            ) : null}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingPw}
                className="rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {savingPw ? "Đang lưu..." : "Đổi mật khẩu"}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span
                className={clsx(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  twoFa ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400",
                )}
              >
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h3 className="font-semibold text-slate-800">Xác thực 2 lớp</h3>
                <p className="text-sm text-slate-500">
                  {twoFa ? "Đã bật · Google Authenticator" : "Chưa bật"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const next = !twoFa;
                setTwoFa(next);
                localStorage.setItem(TWO_FA_KEY, next ? "1" : "0");
                onToast(next ? "Đã bật 2FA" : "Đã tắt 2FA");
              }}
              className="rounded-xl border border-indigo-200 px-4 py-2 text-sm font-semibold text-indigo-600"
            >
              Quản lý 2FA
            </button>
          </div>
        </section>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-4 xl:w-[320px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800">Thiết bị đã đăng nhập</h3>
          <ul className="mt-3 space-y-3">
            {devices.length === 0 ? (
              <li className="text-sm text-slate-400">Chưa có phiên đăng nhập.</li>
            ) : (
              devices.map((d) => {
                const Icon =
                  d.kind === "phone" ? Smartphone : d.kind === "tablet" ? Tablet : Laptop;
                return (
                  <li key={d.id} className="flex items-start gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800">
                        {d.name}
                        {d.current ? (
                          <span className="ml-2 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
                            Hiện tại
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-slate-400">
                        {d.detail} · {d.location}
                      </p>
                      <p className="text-[11px] text-slate-400">{d.time}</p>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
          <button
            type="button"
            onClick={() => {
              void logoutOtherDevices()
                .then(async () => {
                  setDevices(await fetchSessions());
                  onToast("Đã đăng xuất các thiết bị khác");
                })
                .catch((e) => onToast(e.message));
            }}
            className="mt-4 w-full rounded-xl border border-rose-200 py-2 text-sm font-semibold text-rose-600"
          >
            Đăng xuất khỏi tất cả thiết bị khác
          </button>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={loggingOut}
              onClick={() => {
                if (!window.confirm("Đăng xuất khỏi thiết bị này?")) return;
                setLoggingOut(true);
                void apiLogout()
                  .then(() => {
                    router.replace("/login");
                    router.refresh();
                  })
                  .finally(() => setLoggingOut(false));
              }}
              className="w-full rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              {loggingOut ? "Đang đăng xuất..." : "Đăng xuất thiết bị này"}
            </button>
            <button
              type="button"
              disabled={loggingOut}
              onClick={() => {
                if (
                  !window.confirm(
                    "Đăng xuất tất cả thiết bị (gồm cả thiết bị này)?",
                  )
                ) {
                  return;
                }
                setLoggingOut(true);
                void logoutAllDevices()
                  .then(() => {
                    router.replace("/login");
                    router.refresh();
                  })
                  .finally(() => setLoggingOut(false));
              }}
              className="w-full rounded-xl bg-rose-500 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              Đăng xuất tất cả thiết bị
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-base font-bold text-slate-800">Lịch sử đăng nhập</h3>
          <p className="mt-0.5 text-sm text-slate-500">
            Các lần đăng nhập gần đây của tài khoản
          </p>
          <ol className="mt-4">
            {history.length === 0 ? (
              <li className="text-sm text-slate-400">Chưa có lịch sử đăng nhập.</li>
            ) : (
              history.map((h, index) => (
                <li key={h.id} className="relative flex gap-3 pb-4 last:pb-0">
                  {index < history.length - 1 ? (
                    <span
                      aria-hidden
                      className="absolute top-2.5 left-[5px] h-[calc(100%-4px)] w-px bg-indigo-200"
                    />
                  ) : null}
                  <span className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-indigo-500" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-800">
                        {h.time}
                      </p>
                      <span
                        className={clsx(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          h.ok
                            ? "bg-[#e6f4ea] text-[#2d7a4d]"
                            : "bg-[#f9dedc] text-[#b3261e]",
                        )}
                      >
                        {h.ok ? "Thành công" : "Thất bại"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {h.device} • {h.location}
                    </p>
                  </div>
                </li>
              ))
            )}
          </ol>
          <button
            type="button"
            onClick={() => setHistoryLimit(100)}
            className="mt-2 w-full rounded-xl border border-indigo-200 bg-white py-2.5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
          >
            Xem tất cả lịch sử
          </button>
        </section>
      </aside>
    </div>
  );
}

function PasswordField({
  label,
  value,
  show,
  onToggle,
  onChange,
}: {
  label: string;
  value: string;
  show: boolean;
  onToggle: () => void;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <span className="relative mt-1 block">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} pr-10`}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute top-1/2 right-3 -translate-y-1/2 text-slate-400"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </span>
    </label>
  );
}
