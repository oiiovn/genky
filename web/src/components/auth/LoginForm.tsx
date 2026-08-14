"use client";

import { useState } from "react";
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Headphones,
  Lock,
  Mail,
  ShieldCheck,
  UserPlus,
  UserRound,
} from "lucide-react";
import clsx from "clsx";
import { login, register, resolvePostAuthPath, saveTokens } from "@/lib/api";
import { describeFetchError } from "@/lib/api-base";
import { hardPush } from "@/lib/nav";

export function LoginForm() {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fd = new FormData(e.currentTarget);
    const loginId = String(fd.get("login") ?? email).trim();
    const passwordValue = String(fd.get("password") ?? password);
    const nameValue = String(fd.get("name") ?? name).trim();
    const orgValue = String(
      fd.get("organization_name") ?? organizationName,
    ).trim();
    const confirmValue = String(
      fd.get("password_confirmation") ?? passwordConfirmation,
    );

    try {
      const result =
        tab === "login"
          ? await login({ login: loginId, password: passwordValue })
          : await register({
              name: nameValue,
              email: loginId,
              password: passwordValue,
              password_confirmation: confirmValue,
              organization_name: orgValue,
            });

      saveTokens(result.access_token, result.refresh_token);
      try {
        const next = await resolvePostAuthPath();
        hardPush(next);
      } catch {
        hardPush("/onboarding");
      }
    } catch (err) {
      const msg = describeFetchError(err);
      const duplicate =
        /email đã được sử dụng|đã được sử dụng/i.test(msg);
      if (tab === "register" && duplicate) {
        setTab("login");
        setError("Email này đã có tài khoản. Hãy đăng nhập bằng mật khẩu đã tạo.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full max-w-[420px] flex-col">
      <div className="mb-5 flex items-center justify-between text-sm">
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-slate-600 shadow-sm"
        >
          <span className="text-base leading-none">🇻🇳</span>
          Tiếng Việt
        </button>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-slate-500 hover:text-indigo-600"
        >
          <Headphones className="h-4 w-4" />
          Cần hỗ trợ?
        </button>
      </div>

      <div className="rounded-[28px] border border-white/80 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.12)] sm:p-8">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex items-center gap-2.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-lg shadow-indigo-200">
              G
            </div>
            <span className="text-2xl font-extrabold tracking-tight text-slate-800">
              GENKY
            </span>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => {
              setTab("login");
              setError(null);
            }}
            className={clsx(
              "flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition",
              tab === "login"
                ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            <UserRound className="h-4 w-4" />
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("register");
              setError(null);
            }}
            className={clsx(
              "flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition",
              tab === "register"
                ? "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-200"
                : "text-slate-500 hover:text-slate-700",
            )}
          >
            <UserPlus className="h-4 w-4" />
            Đăng ký tài khoản
          </button>
        </div>

        <div className="mb-5">
          <h1 className="text-xl font-bold text-slate-800">
            {tab === "login"
              ? "Chào mừng bạn quay trở lại! 👋"
              : "Tạo tài khoản Genky"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {tab === "login"
              ? "Đăng nhập để tiếp tục quản lý nhân sự với Genky"
              : "Đăng ký để bắt đầu quản lý nhân sự với Genky"}
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4" autoComplete="on">
          {tab === "register" && (
            <>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Họ và tên
                </label>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    name="name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ví dụ: Vũ"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-3 pl-10 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Tên tổ chức / cửa hàng
                </label>
                <div className="relative">
                  <Building2 className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    name="organization_name"
                    type="text"
                    autoComplete="organization"
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder="Ví dụ: FRESH - Bánh tráng trộn"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-3 pl-10 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Email hoặc số điện thoại
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                required
                name="login"
                type="text"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onInput={(e) => setEmail((e.target as HTMLInputElement).value)}
                placeholder="Nhập email hoặc số điện thoại"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-3 pl-10 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Mật khẩu
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    tab === "login" ? "current-password" : "new-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onInput={(e) =>
                    setPassword((e.target as HTMLInputElement).value)
                  }
                placeholder="Nhập mật khẩu"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-11 pl-10 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
                aria-label="Hiện mật khẩu"
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {tab === "register" && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Xác nhận mật khẩu
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    required
                    name="password_confirmation"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                  placeholder="Nhập lại mật khẩu"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-3 pl-10 text-sm outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            </div>
          )}

          {tab === "login" && (
            <div className="flex items-center justify-between text-sm">
              <label className="flex cursor-pointer items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Ghi nhớ đăng nhập
              </label>
              <button
                type="button"
                className="font-medium text-indigo-600 hover:text-indigo-700"
              >
                Quên mật khẩu?
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-500 to-violet-500 py-3.5 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:brightness-105 disabled:opacity-60"
          >
            <ArrowRight className="h-4 w-4" />
            {loading
              ? "Đang xử lý..."
              : tab === "login"
                ? "Đăng nhập »"
                : "Tạo tài khoản »"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400">Hoặc đăng nhập với</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Google
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Apple
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-indigo-50 px-3 py-2.5 text-xs text-indigo-700">
          <ShieldCheck className="h-4 w-4 text-indigo-500" />
          <span>
            Dữ liệu của bạn luôn được{" "}
            <strong className="font-semibold">bảo mật tuyệt đối</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
