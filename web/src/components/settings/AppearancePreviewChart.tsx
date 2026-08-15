"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip } from "recharts";

const CHART = [
  { d: "T2", v: 72 },
  { d: "T3", v: 88 },
  { d: "T4", v: 64 },
  { d: "T5", v: 91 },
  { d: "T6", v: 78 },
  { d: "T7", v: 96 },
  { d: "CN", v: 54 },
];

export function AppearancePreviewChart({ primary }: { primary: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={CHART}>
        <defs>
          <linearGradient id="previewFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={primary} stopOpacity={0.35} />
            <stop offset="100%" stopColor={primary} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Tooltip
          contentStyle={{
            fontSize: 10,
            borderRadius: 8,
            padding: "4px 8px",
          }}
        />
        <Area
          type="monotone"
          dataKey="v"
          stroke={primary}
          strokeWidth={2}
          fill="url(#previewFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
