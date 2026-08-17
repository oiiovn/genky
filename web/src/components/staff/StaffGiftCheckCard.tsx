"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Gift, TicketCheck } from "lucide-react";
import {
  checkMarketingRewardCode,
  redeemMarketingRewardCode,
  type MarketingRewardCodeCheck,
} from "@/lib/marketing-api";
import { formatVnd } from "@/lib/staff";

function formatExpire(iso: string | null): string {
  if (!iso) return "Không hạn";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const statusCopy: Record<
  string,
  { label: string; tone: string; hint: string }
> = {
  ISSUED: {
    label: "Có thể tặng",
    tone: "bg-emerald-400/15 text-emerald-200",
    hint: "Đối chiếu món rồi nhấn xác nhận.",
  },
  REDEEMED: {
    label: "Đã tặng",
    tone: "bg-slate-400/15 text-slate-300",
    hint: "Mã này đã được xác nhận trước đó.",
  },
  EXPIRED: {
    label: "Hết hạn",
    tone: "bg-rose-400/20 text-rose-200",
    hint: "Mã đã hết hạn, không tặng được.",
  },
  CANCELLED: {
    label: "Đã huỷ",
    tone: "bg-slate-400/15 text-slate-300",
    hint: "Mã đã bị huỷ.",
  },
};

export function StaffGiftCheckCard({
  branches,
  preferredBranchId,
}: {
  branches: { id: number; name: string }[];
  preferredBranchId?: number;
}) {
  const [query, setQuery] = useState("");
  const [checking, setChecking] = useState(false);
  const [found, setFound] = useState<MarketingRewardCodeCheck | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMsg, setRedeemMsg] = useState<string | null>(null);

  const branchId = useMemo(() => {
    if (preferredBranchId && branches.some((b) => b.id === preferredBranchId)) {
      return preferredBranchId;
    }
    if (found?.branch?.id && branches.some((b) => b.id === found.branch?.id)) {
      return found.branch.id;
    }
    return branches[0]?.id ?? null;
  }, [branches, preferredBranchId, found?.branch?.id]);

  useEffect(() => {
    const code = query.trim();
    setRedeemMsg(null);
    if (code.length < 4) {
      setFound(null);
      setCheckError(null);
      setChecking(false);
      return;
    }

    const ac = new AbortController();
    setChecking(true);
    setFound(null);
    setCheckError(null);
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const data = await checkMarketingRewardCode(code, ac.signal);
          if (ac.signal.aborted) return;
          setFound(data);
          setCheckError(null);
        } catch (e: unknown) {
          if (ac.signal.aborted) return;
          if (e instanceof Error && e.name === "AbortError") return;
          setFound(null);
          setCheckError(
            e instanceof Error ? e.message : "Không kiểm tra được mã tặng.",
          );
        } finally {
          if (!ac.signal.aborted) setChecking(false);
        }
      })();
    }, 320);

    return () => {
      ac.abort();
      window.clearTimeout(t);
    };
  }, [query]);

  async function handleRedeem() {
    if (!found?.valid || !branchId || redeeming) return;
    setRedeeming(true);
    setCheckError(null);
    try {
      await redeemMarketingRewardCode(found.id, { branch_id: branchId });
      setRedeemMsg("Đã xác nhận tặng món.");
      setFound({
        ...found,
        valid: false,
        status: "REDEEMED",
        reason: "Mã đã được đổi.",
        redeemed_at: new Date().toISOString(),
      });
    } catch (e: unknown) {
      setCheckError(
        e instanceof Error ? e.message : "Không xác nhận được tặng món.",
      );
    } finally {
      setRedeeming(false);
    }
  }

  const st = found
    ? (statusCopy[found.status] ?? {
        label: found.status,
        tone: "bg-white/10 text-slate-200",
        hint: found.reason || "",
      })
    : null;
  const displayValue = found?.reward?.display_value || found?.reward?.value || 0;

  return (
    <section className="mb-5 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-violet-500/20 via-indigo-500/10 to-transparent p-4">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-400 to-indigo-500 text-white">
          <TicketCheck className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white">
            Kiểm tra & xác nhận tặng
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Nhập mã tặng hoặc mã đơn — kết quả hiện ngay.
          </p>
        </div>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        placeholder="Mã tặng hoặc mã đơn…"
        className="mt-3 w-full rounded-2xl border border-white/15 bg-black/25 px-3 py-3 font-mono text-sm text-white outline-none placeholder:font-sans placeholder:text-slate-500 focus:border-violet-300/50"
      />

      {checking ? (
        <p className="mt-3 text-xs text-slate-400">Đang kiểm tra…</p>
      ) : null}

      {checkError ? (
        <p className="mt-3 rounded-2xl bg-rose-500/15 px-3 py-2.5 text-sm text-rose-200">
          {checkError}
        </p>
      ) : null}

      {redeemMsg ? (
        <p className="mt-3 rounded-2xl bg-emerald-400/15 px-3 py-2.5 text-sm text-emerald-200">
          {redeemMsg}
        </p>
      ) : null}

      {found ? (
        <div className="mt-3 rounded-2xl bg-black/25 p-3">
          {found.missing_review ? (
            <p className="mb-3 flex items-start gap-2 rounded-2xl bg-amber-400/20 px-3 py-2.5 text-sm font-semibold text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Phát hiện chưa có đánh giá,{" "}
                <span className="underline decoration-amber-200/80 underline-offset-2">
                  kiểm tra ngay
                </span>
              </span>
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            {found.reward?.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={found.reward.image_url}
                alt={found.reward.name}
                className="h-16 w-16 rounded-2xl object-cover ring-1 ring-white/15"
              />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 text-2xl">
                🎁
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold text-white">
                  {found.reward?.name ?? "Quà tặng"}
                </p>
                {st ? (
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${st.tone}`}
                  >
                    {st.label}
                  </span>
                ) : null}
              </div>
              {displayValue > 0 ? (
                <p className="mt-0.5 text-xs text-violet-200">
                  Trị giá {formatVnd(displayValue)}
                </p>
              ) : null}
              <p className="mt-0.5 font-mono text-xs text-slate-300">
                {found.code}
              </p>
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-xl bg-white/5 px-2.5 py-2">
              <dt className="text-slate-400">Mã đơn</dt>
              <dd className="mt-0.5 font-medium text-slate-100">
                {found.order?.order_code || "—"}
              </dd>
            </div>
            <div className="rounded-xl bg-white/5 px-2.5 py-2">
              <dt className="text-slate-400">Hết hạn</dt>
              <dd className="mt-0.5 font-medium text-slate-100">
                {formatExpire(found.expires_at)}
              </dd>
            </div>
          </dl>

          {found.reason || st?.hint ? (
            <p
              className={`mt-2 text-xs ${
                found.status === "EXPIRED" || found.status === "CANCELLED"
                  ? "text-rose-200"
                  : "text-slate-400"
              }`}
            >
              {found.reason || st?.hint}
            </p>
          ) : null}

          {found.valid ? (
            <button
              type="button"
              onClick={() => void handleRedeem()}
              disabled={redeeming || !branchId}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-900 disabled:opacity-60"
            >
              <CheckCircle2 className="h-4 w-4" />
              {redeeming
                ? "Đang xác nhận…"
                : branchId
                  ? "Xác nhận tặng"
                  : "Chưa có chi nhánh"}
            </button>
          ) : found.status === "EXPIRED" ? (
            <p className="mt-3 flex items-center justify-center gap-1.5 rounded-2xl bg-rose-500/20 px-4 py-3 text-sm font-semibold text-rose-100">
              <Gift className="h-4 w-4" />
              Không tặng được — mã hết hạn
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
