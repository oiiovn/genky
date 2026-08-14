"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { RefreshCw } from "lucide-react";

export function QrCodePanel({
  value,
  expiresIn,
  updatedAt,
  enabled,
  onRefresh,
}: {
  value: string | null;
  expiresIn: number;
  updatedAt: string | null;
  enabled: boolean;
  onRefresh: () => void;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!value || !enabled) {
        setDataUrl(null);
        return;
      }
      try {
        const url = await QRCode.toDataURL(value, {
          width: 280,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        if (!cancelled) setDataUrl(url);
      } catch {
        if (!cancelled) setDataUrl(null);
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [value, enabled]);

  const mm = String(Math.floor(Math.max(0, expiresIn) / 60)).padStart(2, "0");
  const ss = String(Math.max(0, expiresIn) % 60).padStart(2, "0");

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-800">
        Quét QR để chấm công
      </h3>

      <div className="mt-6 flex justify-center">
        <div className="relative rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <span className="absolute top-2 left-2 h-6 w-6 rounded-tl-lg border-t-4 border-l-4 border-indigo-500" />
          <span className="absolute top-2 right-2 h-6 w-6 rounded-tr-lg border-t-4 border-r-4 border-indigo-500" />
          <span className="absolute bottom-2 left-2 h-6 w-6 rounded-bl-lg border-b-4 border-l-4 border-indigo-500" />
          <span className="absolute bottom-2 right-2 h-6 w-6 rounded-br-lg border-b-4 border-r-4 border-indigo-500" />
          {enabled && dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt="QR chấm công" className="h-56 w-56" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center text-center text-sm text-slate-400">
              {enabled ? "Đang tạo QR..." : "QR đang tắt"}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm">
          <span className="text-slate-500">QR sẽ đổi sau </span>
          <span className="font-semibold text-indigo-600">
            {mm}:{ss}
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50"
          aria-label="Làm mới QR"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-slate-400">
        Cập nhật lần cuối: {updatedAt ?? "—"}
      </p>
    </section>
  );
}
