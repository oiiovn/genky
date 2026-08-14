"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";

export function InviteLinkModal({
  open,
  employeeName,
  email,
  inviteUrl,
  onClose,
}: {
  open: boolean;
  employeeName: string;
  email: string;
  inviteUrl: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">
            Mời tạo tài khoản
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-slate-600">
          Gửi link cho <span className="font-semibold">{employeeName}</span> (
          {email}) để đặt mật khẩu và đăng nhập chấm công.
        </p>

        <div className="mt-4 flex gap-2">
          <input
            readOnly
            value={inviteUrl}
            className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
          />
          <button
            type="button"
            onClick={() => void copy()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 px-3 py-2 text-sm font-semibold text-white"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4" />
                Đã chép
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Sao chép
              </>
            )}
          </button>
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Link hết hạn sau 7 ngày. Chưa gửi email tự động — hãy chia sẻ thủ công.
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600"
        >
          Đóng
        </button>
      </div>
    </div>
  );
}
