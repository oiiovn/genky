"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  acceptInvitation,
  fetchInvitation,
  type InvitationPreview,
} from "@/lib/employees-api";
import { saveTokens } from "@/lib/api";

export default function InviteAcceptPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const router = useRouter();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchInvitation(token);
        setPreview(data);
        setName(data.employee?.full_name ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Link không hợp lệ.");
      } finally {
        setLoading(false);
      }
    }
    if (token) void load();
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!preview?.is_valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const session = await acceptInvitation(token, {
        name: name.trim() || undefined,
        password,
        password_confirmation: passwordConfirmation,
      });
      saveTokens(session.access_token, session.refresh_token);
      router.replace("/m");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể kích hoạt.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F3F4F6] px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold tracking-wide text-indigo-500 uppercase">
          Genky
        </p>
        <h1 className="mt-1 text-xl font-bold text-slate-800">
          Kích hoạt tài khoản nhân viên
        </h1>

        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Đang tải lời mời...</p>
        ) : !preview ? (
          <p className="mt-6 text-sm text-rose-600">
            {error ?? "Không tìm thấy lời mời."}
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-500">
              {preview.organization?.name ?? "Tổ chức"} ·{" "}
              {preview.employee?.full_name ?? "Nhân viên"} (
              {preview.employee?.employee_code})
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Email đăng nhập:{" "}
              <span className="font-semibold">{preview.email}</span>
            </p>

            {!preview.is_valid ? (
              <p className="mt-6 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                {preview.accepted
                  ? "Lời mời đã được chấp nhận. Hãy đăng nhập."
                  : "Lời mời đã hết hạn. Nhờ quản lý gửi lại."}
              </p>
            ) : (
              <form onSubmit={onSubmit} className="mt-6 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Họ và tên
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Mật khẩu
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                    placeholder="Tối thiểu 8 ký tự"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Xác nhận mật khẩu
                  </label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={passwordConfirmation}
                    onChange={(e) => setPasswordConfirmation(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400"
                  />
                </div>

                {error && (
                  <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-600">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {submitting ? "Đang kích hoạt..." : "Tạo tài khoản & đăng nhập"}
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
