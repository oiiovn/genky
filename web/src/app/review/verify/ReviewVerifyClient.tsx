"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Gift, Loader2, Search } from "lucide-react";
import {
  defaultReviewBoostSettings,
  loadReviewBoostSettings,
} from "@/lib/review-boost-settings";

type Step = "input" | "loading" | "success" | "error";

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "https://api.genky.vn/api";

/**
 * Customer QR → verify-order (claim_token) → claim/{token} → show reward
 */
export default function ReviewVerifyClient() {
  const search = useSearchParams();
  const campaignToken =
    search.get("token") || search.get("campaign_token") || "";

  const settings = useMemo(() => {
    try {
      return loadReviewBoostSettings("org");
    } catch {
      return defaultReviewBoostSettings();
    }
  }, []);

  const style = settings.style;
  const [orderCode, setOrderCode] = useState("");
  const [step, setStep] = useState<Step>("input");
  const [rewardCode, setRewardCode] = useState("");
  const [giftName, setGiftName] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    const code = orderCode.trim();
    if (code.length < 4) {
      setError("Vui lòng nhập mã đơn hàng hợp lệ.");
      setStep("error");
      return;
    }
    if (!campaignToken) {
      setError("Thiếu campaign token trên QR. Quét lại QR chiến dịch.");
      setStep("error");
      return;
    }

    setError(null);
    setStep("loading");

    try {
      const verifyRes = await fetch(
        `${API_BASE}/public/review-reward/verify-order`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            campaign_token: campaignToken,
            order_code: code,
          }),
        },
      );
      const verifyJson = (await verifyRes.json()) as {
        success?: boolean;
        claim_token?: string;
        message?: string;
        errors?: Record<string, string[]>;
      };

      if (!verifyRes.ok || !verifyJson.claim_token) {
        const firstError = verifyJson.errors
          ? Object.values(verifyJson.errors)[0]?.[0]
          : verifyJson.message;
        throw new Error(firstError || "Không xác minh được mã đơn.");
      }

      const claimRes = await fetch(
        `${API_BASE}/public/review-reward/claim/${encodeURIComponent(verifyJson.claim_token)}`,
        { headers: { Accept: "application/json" } },
      );
      const claimJson = (await claimRes.json()) as {
        success?: boolean;
        reward?: { name: string; code: string; expires_at: string | null };
        message?: string;
        errors?: Record<string, string[]>;
      };

      if (!claimRes.ok || !claimJson.reward) {
        const firstError = claimJson.errors
          ? Object.values(claimJson.errors)[0]?.[0]
          : claimJson.message;
        throw new Error(firstError || "Không lấy được mã quà.");
      }

      setGiftName(claimJson.reward.name);
      setRewardCode(claimJson.reward.code);
      setExpiresAt(claimJson.reward.expires_at);
      setStep("success");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      setStep("error");
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: style.background, color: style.text }}
    >
      <div className="w-full max-w-sm overflow-hidden rounded-[1.75rem] border border-black/5 bg-white shadow-xl">
        <div className="px-6 pt-8 pb-6 text-center">
          <p
            className="text-xs font-bold tracking-[0.2em]"
            style={{ color: style.text }}
          >
            GENKY
          </p>
          <h1
            className="mt-3 text-xl leading-snug font-extrabold"
            style={{ color: style.primary }}
          >
            ĐÁNH GIÁ 5★
            <br />
            NHẬN QUÀ NGAY!
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Nhập mã đơn hàng để nhận mã đổi quà.
          </p>

          <div className="mx-auto mt-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-3xl">
            🎁
          </div>

          {step !== "success" ? (
            <div className="mt-6 space-y-3 text-left">
              <label className="block text-sm font-medium text-slate-700">
                Mã đơn hàng
                <div className="relative mt-1.5">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={orderCode}
                    onChange={(e) => {
                      setOrderCode(e.target.value);
                      if (step === "error") setStep("input");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void verify();
                    }}
                    placeholder="VD: #13086-788608854"
                    className="w-full rounded-xl border border-slate-200 py-3 pr-3 pl-10 text-sm outline-none focus:border-orange-400"
                    inputMode="text"
                    autoComplete="off"
                  />
                </div>
              </label>

              {error ? (
                <p className="text-sm text-rose-600">{error}</p>
              ) : null}

              <button
                type="button"
                onClick={() => void verify()}
                disabled={step === "loading"}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: style.primary }}
              >
                {step === "loading" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Đang kiểm tra…
                  </>
                ) : (
                  "KIỂM TRA NGAY"
                )}
              </button>
            </div>
          ) : (
            <div className="mt-6 space-y-4 text-left">
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4" />
                Đơn hàng hợp lệ — đây là mã quà của bạn
              </div>

              <div className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 px-4 py-5 text-center">
                <p className="text-xs text-slate-500">Mã đổi quà</p>
                <p
                  className="mt-1 font-mono text-2xl font-bold tracking-wider"
                  style={{ color: style.primary }}
                >
                  {rewardCode}
                </p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-slate-700">
                  <Gift className="h-4 w-4" />
                  {giftName}
                </p>
                {expiresAt ? (
                  <p className="mt-1 text-xs text-slate-500">
                    Hết hạn: {expiresAt}
                  </p>
                ) : null}
              </div>

              <p className="text-center text-xs text-slate-500">
                Đưa mã này cho nhân viên tại quầy để đổi quà.
              </p>

              <button
                type="button"
                onClick={() => {
                  setStep("input");
                  setOrderCode("");
                  setRewardCode("");
                  setExpiresAt(null);
                }}
                className="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700"
              >
                Kiểm tra đơn khác
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
