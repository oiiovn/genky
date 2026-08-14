"use client";

import Link from "next/link";
import { Award, ChevronRight, CircleUserRound, Umbrella } from "lucide-react";

const links = [
  { href: "/m/leave", label: "Nghỉ phép", icon: Umbrella },
  { href: "/m/adjustments", label: "Thưởng / Phạt", icon: Award },
  { href: "/m/profile", label: "Hồ sơ của tôi", icon: CircleUserRound },
];

export default function StaffMorePage() {
  return (
    <div className="px-4 pt-6">
      <h1 className="text-xl font-bold text-white">Thêm</h1>
      <p className="mt-1 text-sm text-slate-400">Tiện ích nhân viên</p>

      <div className="mt-5 space-y-2">
        {links.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5"
            >
              <span className="flex items-center gap-3 text-sm font-medium text-slate-100">
                <Icon className="h-4 w-4 text-sky-300" />
                {item.label}
              </span>
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
