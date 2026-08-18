"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  ExternalLink,
  Gift,
  Info,
  Pause,
  Play,
  ShoppingBag,
  Star,
  Store,
  Volume2,
  X,
} from "lucide-react";
import {
  fetchMarketingLandingAudio,
  fetchMarketingRewards,
  fetchPublicLanding,
  fetchPublicLandingAudio,
  spinPublicReviewReward,
  verifyPublicRewardByQrToken,
  type PublicSpinReward,
} from "@/lib/marketing-api";
import type {
  ReviewBoostFullSettings,
  ReviewGiftItemSetting,
  ReviewLandingCopy,
  ReviewStyleSettings,
} from "@/lib/review-boost-settings";

function enabledGifts(items: ReviewGiftItemSetting[]): ReviewGiftItemSetting[] {
  return items
    .filter((gift) => gift.enabled)
    .slice()
    .sort(
      (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name),
    );
}

const PETALS = ["🌸", "🌺", "🌼", "💮", "🏵️", "💐", "🌷"];

function FallingPetals() {
  const items = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        emoji: PETALS[i % PETALS.length],
        left: `${(i * 19 + 5) % 96}%`,
        delay: `${(i % 9) * 0.16}s`,
        duration: `${2.2 + (i % 7) * 0.32}s`,
        size: 18 + (i % 5) * 5,
      })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {items.map((p) => (
        <span
          key={p.id}
          className="absolute top-[-8%]"
          style={{
            left: p.left,
            fontSize: p.size,
            animation: `petal-fall ${p.duration} linear ${p.delay} forwards`,
          }}
        >
          {p.emoji}
        </span>
      ))}
    </div>
  );
}

function formatExpire(value: string | null): string | null {
  if (!value) return null;
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return value;
}

function formatVnd(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}

function giftValue(gift: { displayValue?: number; value: number }): number {
  return gift.displayValue && gift.displayValue > 0
    ? gift.displayValue
    : gift.value;
}

function toHref(url: string): string {
  const t = url.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function OrderAppButtons({
  shopeeUrl,
  grabUrl,
  radius,
  className = "",
}: {
  shopeeUrl: string;
  grabUrl: string;
  radius: string;
  className?: string;
}) {
  const apps = [
    shopeeUrl
      ? { id: "shopee", label: "ShopeeFood", href: toHref(shopeeUrl), bg: "#EE4D2D" }
      : null,
    grabUrl
      ? { id: "grab", label: "GrabFood", href: toHref(grabUrl), bg: "#00B14F" }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  if (apps.length === 0) return null;

  return (
    <div
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: apps.length > 1 ? "1fr 1fr" : "1fr",
        gap: 8,
      }}
    >
      {apps.map((app) => (
        <a
          key={app.id}
          href={app.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-1.5 py-3 text-sm font-bold text-white"
          style={{ background: app.bg, borderRadius: radius }}
        >
          {app.label}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ))}
    </div>
  );
}

export function ReviewLandingPage({
  settings,
  orgId,
  qrToken,
  embedded = false,
}: {
  settings: ReviewBoostFullSettings;
  preview?: boolean;
  orgId?: number | string;
  qrToken?: string;
  embedded?: boolean;
}) {
  const [orderCode, setOrderCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [won, setWon] = useState<PublicSpinReward | null>(null);
  const settingsGifts = useMemo(
    () => enabledGifts(settings.gifts),
    [settings.gifts],
  );
  const [apiGifts, setApiGifts] = useState<ReviewGiftItemSetting[] | null>(null);
  const [apiAudioUrl, setApiAudioUrl] = useState<string | null | undefined>(
    undefined,
  );
  const [playing, setPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [remoteLanding, setRemoteLanding] = useState<Partial<ReviewLandingCopy>>(
    {},
  );
  const [remoteStyle, setRemoteStyle] = useState<Partial<ReviewStyleSettings>>(
    {},
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const copy = {
    ...settings.landing,
    ...remoteLanding,
  };
  const style = {
    ...settings.style,
    ...remoteStyle,
  };
  const gifts = embedded ? settingsGifts : (apiGifts ?? settingsGifts);
  const guideSrc = embedded
    ? (copy.guideAudioUrl ?? null)
    : (apiAudioUrl !== undefined ? apiAudioUrl : (copy.guideAudioUrl ?? null));

  const notes = copy.notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  useEffect(() => {
    if (embedded) return;
    const ac = new AbortController();
    void (async () => {
      try {
        const rows = await fetchMarketingRewards(ac.signal);
        if (ac.signal.aborted) return;
        setApiGifts(
          enabledGifts(
            rows.map((row) => ({
              id: String(row.id),
              name: row.name,
              imageUrl: row.image_url,
              value: row.value,
              displayValue:
                row.display_value > 0 ? row.display_value : row.value,
              enabled: row.enabled,
              sort_order: row.sort_order,
            })),
          ),
        );
      } catch {
        /* giữ món từ bản nháp nếu chưa đăng nhập */
      }
    })();
    return () => ac.abort();
  }, [embedded]);

  const publicContext = qrToken ? `token:${qrToken}` : (orgId ?? "");

  useEffect(() => {
    if (embedded) return;
    const ac = new AbortController();
    void (async () => {
      try {
        let audio = await fetchPublicLandingAudio(publicContext, ac.signal);
        if (!audio.audio_url) {
          audio = await fetchMarketingLandingAudio(ac.signal);
        }
        if (ac.signal.aborted) return;
        setApiAudioUrl(audio.audio_url || null);
      } catch {
        try {
          const audio = await fetchMarketingLandingAudio(ac.signal);
          if (!ac.signal.aborted) setApiAudioUrl(audio.audio_url || null);
        } catch {
          /* giữ URL từ bản nháp */
        }
      }
    })();
    return () => ac.abort();
  }, [publicContext, embedded]);

  useEffect(() => {
    if (embedded) return;
    const ac = new AbortController();
    void (async () => {
      try {
        const remote = await fetchPublicLanding(publicContext, ac.signal);
        if (ac.signal.aborted) return;
        setRemoteLanding(remote.landing as Partial<ReviewLandingCopy>);
        setRemoteStyle(remote.style);
      } catch {
        /* giữ bản nháp local */
      }
    })();
    return () => ac.abort();
  }, [publicContext, embedded]);

  async function copyReward() {
    if (!won) return;
    const text = `${won.code} · ${won.name}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const expireLabel = formatExpire(won?.expires_at ?? null);
  const shopeeUrl = (copy.shopeeFoodUrl || copy.buyNowUrl || "").trim();
  const grabUrl = (copy.grabFoodUrl || "").trim();
  const radius = `${copy.buttonRadius}px`;

  function toggleGuideAudio() {
    const el = audioRef.current;
    if (!guideSrc) {
      setMessage("Chưa có bản ghi hướng dẫn.");
      return;
    }
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
      return;
    }
    void el.play().then(() => setPlaying(true)).catch(() => {
      setPlaying(false);
      setMessage("Không phát được bản ghi.");
    });
  }

  async function onConfirm() {
    if (embedded) {
      setMessage("Đây là bản xem trước. Mở «Xem thử trang» để quay thật.");
      return;
    }
    const code = orderCode.trim();
    if (code.length < 4) {
      setMessage("Vui lòng nhập mã đơn hàng.");
      return;
    }
    setSpinning(true);
    setMessage(null);
    try {
      const reward = qrToken
        ? await verifyPublicRewardByQrToken(qrToken, code)
        : (await spinPublicReviewReward(orgId ?? "", code)).reward;
      setWon(reward);
      setCopied(false);
      setMessage(null);
    } catch (e) {
      setWon(null);
      setMessage(e instanceof Error ? e.message : "Không quay thưởng được.");
    } finally {
      setSpinning(false);
    }
  }

  return (
    <div
      className={embedded ? "relative min-h-full pt-[54px] pb-8" : "min-h-screen"}
      style={{
        background: style.background,
        color: style.text,
        fontFamily: copy.fontFamily,
      }}
    >
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;800;900&family=Inter:wght@400;700;800&family=Nunito:wght@700;900&display=swap"
      />
      <style>{`
        @keyframes petal-fall {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(110vh) rotate(420deg); opacity: 0.15; }
        }
      `}</style>
      <div className="mx-auto max-w-md px-3 pb-10">
        <header className="flex items-center justify-between gap-3 pt-4 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-sm"
              style={{ background: style.primary }}
            >
              <Store className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-extrabold">{copy.shopName}</p>
              <p className="truncate text-xs opacity-70">{copy.tagline}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setStoreOpen(true)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold shadow-sm"
            style={{ color: style.text, borderRadius: radius }}
          >
            <Info className="h-3.5 w-3.5" style={{ color: style.primary }} />
            {copy.storeInfoLabel}
          </button>
        </header>

        <section
          className="relative overflow-hidden rounded-[1.6rem] px-4 pt-5 pb-6 text-white shadow-md"
          style={{ background: `linear-gradient(160deg, ${style.primary}, #FF9F43)` }}
        >
          <p className="mx-auto w-fit rounded-full bg-white/95 px-3 py-1 text-[10px] font-bold tracking-wide text-orange-600">
            {copy.thankYou}
          </p>
          <h1 className="mt-3 text-center text-[1.65rem] leading-tight font-black">
            <span className="block">{copy.headlineAccent}</span>
            <span className="block text-white">{copy.headline}</span>
          </h1>
          <div className="mt-5 flex items-start justify-between gap-2">
            {[
              { icon: ShoppingBag, label: copy.step1 },
              { icon: Star, label: copy.step2 },
              { icon: Gift, label: copy.step3 },
            ].map((step, i) => (
              <div key={step.label} className="flex min-w-0 flex-1 flex-col items-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-orange-500 shadow">
                  <step.icon className="h-5 w-5" />
                </span>
                <p className="mt-2 text-center text-[10px] leading-snug font-semibold">
                  {step.label}
                </p>
                {i < 2 ? (
                  <span className="sr-only">tiếp</span>
                ) : null}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-end justify-between">
            <span className="rounded-full bg-orange-950/20 px-2.5 py-1 text-[10px] font-semibold">
              {copy.expiry}
            </span>
            <span className="rounded-full bg-red-500 px-2.5 py-1 text-[10px] font-bold shadow">
              {copy.badge}
            </span>
          </div>
        </section>

        <section className="mt-4 rounded-[1.6rem] bg-white p-4 shadow-sm">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5" style={{ color: style.primary }} />
            <h2 className="text-sm font-black tracking-wide">{copy.formTitle}</h2>
          </div>
          <p className="mt-1 text-xs opacity-70">{copy.formHint}</p>
          {guideSrc ? (
          <div className="mt-3 flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-2.5">
            <button
              type="button"
              onClick={toggleGuideAudio}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white shadow"
              style={{ background: style.primary }}
              aria-label={playing ? "Tạm dừng" : "Nghe hướng dẫn"}
            >
              {playing ? (
                <Pause className="h-5 w-5" fill="currentColor" />
              ) : (
                <Play className="ml-0.5 h-5 w-5" fill="currentColor" />
              )}
            </button>
            <button
              type="button"
              onClick={toggleGuideAudio}
              className="min-w-0 flex-1 text-left"
            >
              <span className="flex items-center gap-1.5 text-sm font-extrabold tracking-wide">
                <Volume2 className="h-4 w-4" style={{ color: style.primary }} />
                {copy.guideAudioLabel || "Nghe hướng dẫn nhận thưởng"}
              </span>
              <span className="mt-0.5 block text-[11px] opacity-60">
                {playing
                  ? "Đang phát — nhấn để tạm dừng"
                  : "Nhấn để nghe chủ quán hướng dẫn"}
              </span>
            </button>
            <audio
              ref={audioRef}
              src={guideSrc}
              preload="metadata"
              onEnded={() => setPlaying(false)}
              onPause={() => setPlaying(false)}
              onPlay={() => setPlaying(true)}
            />
          </div>
          ) : null}
          <input
            value={orderCode}
            onChange={(e) => setOrderCode(e.target.value)}
            placeholder={copy.orderPlaceholder}
            className="mt-3 w-full border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none"
            style={{ borderRadius: radius }}
          />
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={spinning}
            className="mt-3 w-full py-3 text-sm font-bold text-white disabled:opacity-60"
            style={{ background: style.primary, borderRadius: radius }}
          >
            {spinning
              ? "Đang quay..."
              : copy.confirmLabel === "Xác nhận"
                ? "Quay Thưởng"
                : copy.confirmLabel}
          </button>
          {message ? (
            <p className="mt-2 text-center text-xs text-amber-700">{message}</p>
          ) : null}
          <p className="mt-2 text-[11px] opacity-60">{copy.orderHelp}</p>
          <p className="mt-1 text-[11px] font-semibold" style={{ color: style.primary }}>
            {copy.orderGuide}
          </p>
          <OrderAppButtons
            shopeeUrl={shopeeUrl}
            grabUrl={grabUrl}
            radius={radius}
            className="mt-3"
          />
        </section>

        {gifts.length > 0 ? (
          <section className="mt-4 rounded-[1.6rem] bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5" style={{ color: style.primary }} />
              <h2 className="text-sm font-black tracking-wide">
                {copy.giftsTitle || "PHẦN QUÀ TẶNG"}
              </h2>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {gifts.map((gift) => (
                <div
                  key={gift.id}
                  className="relative aspect-square overflow-hidden rounded-2xl bg-slate-100 shadow-sm"
                >
                  {gift.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={gift.imageUrl}
                      alt={gift.name}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-4xl">
                      🎁
                    </div>
                  )}
                  <p
                    className="absolute inset-x-1.5 bottom-1.5 z-10 px-2 py-1 text-center text-[11px] font-extrabold leading-snug text-white shadow-md"
                    style={{
                      background: style.primary,
                      borderRadius: 10,
                    }}
                  >
                    {gift.name}
                    {giftValue(gift) > 0 ? (
                      <span className="mt-0.5 block text-[10px] font-bold opacity-95">
                        {formatVnd(giftValue(gift))}
                      </span>
                    ) : null}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-4 rounded-[1.6rem] bg-white p-4 shadow-sm">
          <h2 className="text-sm font-black tracking-wide">{copy.notesTitle}</h2>
          <ul className="mt-3 space-y-2">
            {notes.map((line) => (
              <li key={line} className="flex gap-2 text-xs leading-relaxed">
                <span
                  className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: style.primary }}
                >
                  ✓
                </span>
                {line}
              </li>
            ))}
          </ul>
        </section>

        <footer className="mt-5 pb-2 text-center">
          <p className="text-sm font-bold">{copy.footerTitle}</p>
          <p className="mt-1 text-xs opacity-70">{copy.footerText}</p>
        </footer>
      </div>

      {won ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="Đóng"
            onClick={() => setWon(null)}
          />
          <FallingPetals />
          <div
            className="relative z-10 mx-3 mb-6 w-full max-w-sm overflow-hidden rounded-[1.7rem] bg-white p-5 shadow-2xl sm:mb-0"
            style={{ fontFamily: copy.fontFamily, color: style.text }}
          >
            <button
              type="button"
              onClick={() => setWon(null)}
              className="absolute top-3 right-3 rounded-full p-1 text-slate-400 hover:bg-slate-100"
              aria-label="Đóng"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="mx-auto w-44 overflow-hidden rounded-2xl bg-slate-50">
              {won.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={won.image_url}
                  alt={won.name}
                  className="aspect-square w-full object-cover"
                />
              ) : (
                <div className="flex aspect-square items-center justify-center text-5xl">
                  🎁
                </div>
              )}
            </div>
            <p
              className="mt-4 text-center text-xl font-black tracking-wide"
              style={{ color: style.primary }}
            >
              {copy.winTitle || "CHÚC MỪNG!"}
            </p>
            <p className="mt-1.5 text-center text-sm leading-relaxed opacity-80">
              {copy.winMessage ===
                "Bạn đã quay trúng phần quà từ quán. Giữ mã để đổi khi đặt đơn tiếp theo nhé!" ||
              copy.winMessage === "Bạn đã quay trúng phần quà từ quán." ||
              !copy.winMessage
                ? "Bạn đã quay trúng phần quà từ quán. Ghi chú mã tặng cho đơn tới nhé!"
                : copy.winMessage}
            </p>
            <p className="mt-3 text-center text-base font-extrabold">
              {won.name}
            </p>
            {(won.display_value ?? 0) > 0 ? (
              <p
                className="mt-0.5 text-center text-sm font-bold"
                style={{ color: style.primary }}
              >
                Trị giá {formatVnd(won.display_value)}
              </p>
            ) : null}
            <button
              type="button"
              onClick={() => void copyReward()}
              className="mt-3 flex w-full items-center justify-between gap-2 rounded-2xl border border-dashed px-3 py-3 text-left"
              style={{ borderColor: style.primary }}
            >
              <span className="min-w-0">
                <span className="block font-mono text-xl font-bold tracking-wide">
                  {won.code}
                </span>
              </span>
              <span
                className="inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                style={{ background: style.primary }}
              >
                <Copy className="h-3 w-3" />
                {copied ? "Đã copy" : "Copy"}
              </span>
            </button>
            {expireLabel ? (
              <p className="mt-2 text-center text-xs opacity-60">
                Hạn sử dụng: {expireLabel}
              </p>
            ) : (
              <p className="mt-2 text-center text-xs opacity-60">
                Hạn sử dụng: Không hết hạn
              </p>
            )}
            <OrderAppButtons
              shopeeUrl={shopeeUrl}
              grabUrl={grabUrl}
              radius={radius}
              className="mt-4"
            />
          </div>
        </div>
      ) : null}

      {storeOpen ? (
        <div
          className={
            embedded
              ? "absolute inset-0 z-40 flex items-end justify-center bg-black/40 p-3"
              : "fixed inset-0 z-40 flex items-end justify-center bg-black/40 p-3 sm:items-center"
          }
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-[1.6rem] bg-white shadow-2xl"
            style={{ color: style.text }}
          >
            <div className="flex items-center justify-between px-4 pt-4">
              <p className="text-sm font-black tracking-wide">
                {copy.storeInfoLabel}
              </p>
              <button
                type="button"
                onClick={() => setStoreOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="px-4 pb-5 pt-3">
              <p className="text-base font-extrabold">{copy.shopName}</p>
              <p className="mt-0.5 text-xs opacity-70">{copy.tagline}</p>
              <OrderAppButtons
                shopeeUrl={shopeeUrl}
                grabUrl={grabUrl}
                radius={radius}
                className="mt-4"
              />
              {notes.length > 0 ? (
                <ul className="mt-4 space-y-1.5">
                  {notes.map((line) => (
                    <li key={line} className="text-xs leading-relaxed opacity-80">
                      {line}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
