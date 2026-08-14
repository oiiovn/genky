"use client";

import clsx from "clsx";
import {
  CheckCircle2,
  Clock3,
  AlarmClock,
  Umbrella,
  Users,
} from "lucide-react";
import type { Kpi } from "@/types/dashboard";

const iconMap = {
  total: Users,
  working: CheckCircle2,
  not_checked_in: Clock3,
  late: AlarmClock,
  absent: Umbrella,
};

const colorMap = {
  blue: {
    bg: "bg-indigo-50",
    icon: "text-indigo-500",
    stroke: "#6366F1",
  },
  green: {
    bg: "bg-emerald-50",
    icon: "text-emerald-500",
    stroke: "#10B981",
  },
  orange: {
    bg: "bg-amber-50",
    icon: "text-amber-500",
    stroke: "#F59E0B",
  },
  red: {
    bg: "bg-rose-50",
    icon: "text-rose-500",
    stroke: "#F43F5E",
  },
  sky: {
    bg: "bg-sky-50",
    icon: "text-sky-500",
    stroke: "#0EA5E9",
  },
};

function Sparkline({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 120 28" className="mt-3 h-7 w-full" preserveAspectRatio="none">
      <path
        d="M0 20 C15 18, 20 8, 35 12 S55 22, 70 14 S95 6, 120 10"
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <path
        d="M0 20 C15 18, 20 8, 35 12 S55 22, 70 14 S95 6, 120 10 L120 28 L0 28 Z"
        fill={color}
        opacity="0.12"
      />
    </svg>
  );
}

export function KpiCards({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {kpis.map((kpi) => {
        const Icon = iconMap[kpi.key as keyof typeof iconMap] ?? Users;
        const colors = colorMap[kpi.color];
        return (
          <div
            key={kpi.key}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-500">{kpi.label}</p>
                <p className="mt-1 text-2xl font-bold text-slate-800">
                  {kpi.value}
                  {kpi.percent != null && (
                    <span className="ml-1.5 text-sm font-medium text-slate-400">
                      ({kpi.percent}%)
                    </span>
                  )}
                </p>
              </div>
              <div
                className={clsx(
                  "flex h-10 w-10 items-center justify-center rounded-xl",
                  colors.bg,
                )}
              >
                <Icon className={clsx("h-5 w-5", colors.icon)} />
              </div>
            </div>
            <Sparkline color={colors.stroke} />
          </div>
        );
      })}
    </div>
  );
}
