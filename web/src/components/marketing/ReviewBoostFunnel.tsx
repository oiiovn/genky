"use client";

import type { ReviewFunnelStep } from "@/lib/review-boost-types";
import { formatReviewCount } from "@/lib/review-boost-demo";

export function ReviewBoostFunnel({ steps }: { steps: ReviewFunnelStep[] }) {
  const max = Math.max(...steps.map((s) => s.value), 1);

  return (
    <section className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-800">Phễu hiệu quả</h3>
      <p className="mt-0.5 text-xs text-slate-400">
        5★ → xác minh → cấp mã → đổi quà
      </p>
      <ul className="mt-5 space-y-4">
        {steps.map((step, index) => {
          const width = Math.max(28, Math.round((step.value / max) * 100));
          return (
            <li key={step.id}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{step.label}</span>
                <span className="font-semibold text-slate-900">
                  {formatReviewCount(step.value)}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-sky-400"
                  style={{ width: `${width}%` }}
                />
              </div>
              {step.convertPct != null && index < steps.length - 1 ? (
                <p className="mt-1 text-right text-[11px] font-semibold text-blue-600">
                  → {step.convertPct}%
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
