"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

export function ReviewQrPreview({
  value,
  filename = "qr-danh-gia.png",
}: {
  value: string;
  filename?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function render() {
      if (!value) {
        setDataUrl(null);
        setError(null);
        return;
      }
      try {
        const { default: QRCode } = await import("qrcode");
        const url = await QRCode.toDataURL(value, {
          width: 320,
          margin: 2,
          errorCorrectionLevel: "M",
          color: { dark: "#0f172a", light: "#ffffff" },
        });
        if (!cancelled) {
          setDataUrl(url);
          setError(null);
        }
      } catch {
        if (!cancelled) {
          setDataUrl(null);
          setError("Không tạo được mã QR.");
        }
      }
    }
    void render();
    return () => {
      cancelled = true;
    };
  }, [value]);

  function download() {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = filename;
    a.click();
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-800">Mã QR đánh giá</h3>
      <p className="mt-1 text-sm text-slate-500">
        Khách quét để mở trang đánh giá.
      </p>

      <div className="mt-5 flex justify-center">
        <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
          {dataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={dataUrl} alt="QR tăng đánh giá" className="h-56 w-56" />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center text-center text-sm text-slate-400">
              {error ?? "Đang tạo QR…"}
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        disabled={!dataUrl}
        onClick={download}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Download className="h-4 w-4" />
        Tải ảnh QR
      </button>
    </div>
  );
}
