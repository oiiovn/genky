"use client";

import clsx from "clsx";
import {
  Briefcase,
  Building2,
  Check,
  Crown,
  Send,
} from "lucide-react";
import {
  formatVnd,
  type PlanTone,
  type UpgradePlan,
} from "@/lib/plans-api";

const TONE: Record<
  PlanTone,
  {
    iconBg: string;
    iconText: string;
    check: string;
    border: string;
    button: string;
    buttonSolid: string;
  }
> = {
  blue: {
    iconBg: "bg-sky-50",
    iconText: "text-sky-500",
    check: "text-sky-500",
    border: "border-slate-200",
    button: "border-sky-200 text-sky-600 hover:bg-sky-50",
    buttonSolid: "bg-sky-500 text-white hover:bg-sky-600",
  },
  purple: {
    iconBg: "bg-violet-50",
    iconText: "text-violet-500",
    check: "text-violet-500",
    border: "border-violet-300",
    button: "border-violet-200 text-violet-600 hover:bg-violet-50",
    buttonSolid:
      "bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-sm shadow-indigo-200",
  },
  orange: {
    iconBg: "bg-orange-50",
    iconText: "text-orange-500",
    check: "text-orange-500",
    border: "border-slate-200",
    button: "border-orange-200 text-orange-600 hover:bg-orange-50",
    buttonSolid: "bg-orange-500 text-white hover:bg-orange-600",
  },
  green: {
    iconBg: "bg-emerald-50",
    iconText: "text-emerald-500",
    check: "text-emerald-500",
    border: "border-slate-200",
    button: "border-emerald-200 text-emerald-600 hover:bg-emerald-50",
    buttonSolid: "bg-emerald-500 text-white hover:bg-emerald-600",
  },
};

function PlanIcon({ tone }: { tone: PlanTone }) {
  const Icon =
    tone === "blue"
      ? Send
      : tone === "purple"
        ? Crown
        : tone === "orange"
          ? Briefcase
          : Building2;
  const t = TONE[tone];
  return (
    <span
      className={clsx(
        "flex h-11 w-11 items-center justify-center rounded-xl",
        t.iconBg,
        t.iconText,
      )}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}

export function PlanCard({
  plan,
  yearly,
  onAction,
}: {
  plan: UpgradePlan;
  yearly: boolean;
  onAction: (plan: UpgradePlan) => void;
}) {
  const tone = TONE[plan.tone] ?? TONE.blue;
  const cta = plan.contact_only
    ? "Liên hệ tư vấn"
    : plan.is_current
      ? "Gói hiện tại"
      : "Dùng thử miễn phí";

  return (
    <article
      className={clsx(
        "relative flex h-full flex-col rounded-2xl border bg-white p-5 shadow-sm",
        plan.popular ? "border-violet-300 ring-2 ring-violet-100" : tone.border,
      )}
    >
      {plan.popular ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1 text-[11px] font-semibold text-white shadow-sm">
          Phổ biến nhất
        </span>
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <PlanIcon tone={plan.tone} />
        {plan.is_current ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            Đang dùng
          </span>
        ) : null}
      </div>

      <h3 className="mt-4 text-lg font-bold text-slate-800">{plan.name}</h3>
      <p className="mt-1 min-h-[40px] text-sm text-slate-500">{plan.tagline}</p>

          <div className="mt-4">
        {plan.contact_only ? (
          <>
            <p className="text-3xl font-bold text-slate-800">Liên hệ</p>
            <p className="mt-1 text-xs text-slate-400">
              Báo giá theo nhu cầu doanh nghiệp
            </p>
          </>
        ) : (
          <>
            <p className="text-3xl font-bold text-slate-800">
              {formatVnd(plan.price_monthly)}
              <span className="text-sm font-medium text-slate-400">
                {" "}
                / tháng
              </span>
            </p>
            {yearly && plan.price_yearly != null ? (
              <p className="mt-1 text-xs text-slate-500">
                {formatVnd(plan.price_yearly)}/năm
                {plan.savings_yearly ? (
                  <span className="ml-1 font-semibold text-emerald-600">
                    · Tiết kiệm {formatVnd(plan.savings_yearly)}
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">Thanh toán theo tháng</p>
            )}
          </>
        )}
      </div>

      <ul className="mt-5 flex-1 space-y-2.5">
        {plan.highlights.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-slate-600">
            <Check className={clsx("mt-0.5 h-4 w-4 shrink-0", tone.check)} />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        disabled={plan.is_current}
        onClick={() => onAction(plan)}
        className={clsx(
          "mt-6 w-full rounded-xl border py-2.5 text-sm font-semibold transition disabled:cursor-default disabled:opacity-60",
          plan.popular && !plan.is_current
            ? tone.buttonSolid
            : plan.is_current
              ? "border-slate-200 bg-slate-50 text-slate-500"
              : `bg-white ${tone.button}`,
        )}
      >
        {cta}
      </button>
    </article>
  );
}
