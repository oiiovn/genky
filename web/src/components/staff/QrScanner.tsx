"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

let cameraQueue: Promise<void> = Promise.resolve();

async function safeStop(scanner: Html5Qrcode | null) {
  if (!scanner) return;
  try {
    if (scanner.isScanning) {
      await scanner.stop();
    }
  } catch {
    /* ignore */
  }
  try {
    scanner.clear();
  } catch {
    /* ignore */
  }
}

export function QrScanner({
  onScan,
  paused,
}: {
  onScan: (text: string) => void;
  paused?: boolean;
}) {
  const reactId = useId().replace(/:/g, "");
  const elementId = `genky-staff-qr-${reactId}`;
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const handling = useRef(false);
  const pausedRef = useRef(paused);
  const onScanRef = useRef(onScan);
  pausedRef.current = paused;
  onScanRef.current = onScan;

  useEffect(() => {
    let cancelled = false;
    let scanner: Html5Qrcode | null = null;

    cameraQueue = cameraQueue.then(async () => {
      if (cancelled) return;
      scanner = new Html5Qrcode(elementId);
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
          (decoded) => {
            if (pausedRef.current || handling.current) return;
            handling.current = true;
            onScanRef.current(decoded);
            window.setTimeout(() => {
              handling.current = false;
            }, 1800);
          },
          () => undefined,
        );
        if (cancelled) {
          await safeStop(scanner);
          scanner = null;
          return;
        }
        setReady(true);
      } catch {
        await safeStop(scanner);
        scanner = null;
        if (!cancelled) {
          setError(
            "Không mở được camera. Hãy cấp quyền camera hoặc dùng HTTPS.",
          );
        }
      }
    });

    return () => {
      cancelled = true;
      cameraQueue = cameraQueue.then(() => safeStop(scanner));
    };
  }, [elementId]);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black">
      <div id={elementId} className="min-h-[320px] w-full overflow-hidden" />
      {!ready && !error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/80 text-sm text-slate-300">
          Đang mở camera...
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/90 px-6 text-center text-sm text-rose-300">
          {error}
        </div>
      ) : null}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-56 w-56 rounded-3xl border-2 border-sky-300/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      </div>
    </div>
  );
}
