"use client";

import type { ReactNode } from "react";

/** Viewport CSS iPhone 16 Pro: 402 × 874 @3x. */
export const IPHONE_16_PRO = {
  screenW: 402,
  screenH: 874,
  bezel: 11,
  outerRadius: 56,
  screenRadius: 46,
} as const;

const OUTER_W = IPHONE_16_PRO.screenW + IPHONE_16_PRO.bezel * 2;
const OUTER_H = IPHONE_16_PRO.screenH + IPHONE_16_PRO.bezel * 2;

export function Iphone16ProFrame({
  children,
  scale = 0.82,
}: {
  children: ReactNode;
  scale?: number;
}) {
  return (
    <div
      className="relative"
      style={{ width: OUTER_W * scale, height: OUTER_H * scale }}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: OUTER_W,
          height: OUTER_H,
          transform: `scale(${scale})`,
        }}
      >
        <span className="absolute top-[118px] -left-[3px] h-[34px] w-[3px] rounded-l-sm bg-[#3a3a3c]" />
        <span className="absolute top-[178px] -left-[3px] h-[62px] w-[3px] rounded-l-sm bg-[#3a3a3c]" />
        <span className="absolute top-[248px] -left-[3px] h-[62px] w-[3px] rounded-l-sm bg-[#3a3a3c]" />
        <span className="absolute top-[198px] -right-[3px] h-[100px] w-[3px] rounded-r-sm bg-[#3a3a3c]" />

        <div
          className="relative h-full w-full overflow-hidden shadow-[0_24px_60px_rgba(15,23,42,0.35)]"
          style={{
            borderRadius: IPHONE_16_PRO.outerRadius,
            background:
              "linear-gradient(160deg, #5c5c60 0%, #1d1d1f 18%, #2c2c2e 52%, #111113 100%)",
            padding: IPHONE_16_PRO.bezel,
            boxShadow:
              "inset 0 1px 0 rgba(255,255,255,0.28), inset 0 -1px 0 rgba(0,0,0,0.5)",
          }}
        >
          <div
            className="relative h-full w-full overflow-hidden bg-white"
            style={{ borderRadius: IPHONE_16_PRO.screenRadius }}
          >
            <div className="absolute inset-0 overflow-y-auto overscroll-contain">
              {children}
            </div>

            <div className="pointer-events-none absolute left-1/2 top-[11px] z-20 h-[37px] w-[126px] -translate-x-1/2 rounded-full bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]">
              <span className="absolute right-[22px] top-1/2 h-[10px] w-[10px] -translate-y-1/2 rounded-full bg-[#1a1a1c] shadow-[inset_0_0_0_1.5px_#2a3344]" />
              <span className="absolute right-[24px] top-1/2 h-[5px] w-[5px] -translate-y-1/2 rounded-full bg-[#0b1a33] opacity-80" />
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-[7px] z-20 flex justify-center">
              <span className="h-[5px] w-[134px] rounded-full bg-black/80" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
