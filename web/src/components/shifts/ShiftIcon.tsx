"use client";

import { CloudSun, Moon, Sun, Sunset } from "lucide-react";

export function ShiftIcon({
  icon,
  color,
  className,
}: {
  icon: string | null | undefined;
  color: string;
  className?: string;
}) {
  const props = { className: className ?? "h-4 w-4", color };
  switch (icon) {
    case "sun":
      return <Sun {...props} />;
    case "sunset":
      return <Sunset {...props} />;
    case "moon":
    case "night":
      return <Moon {...props} />;
    default:
      return <CloudSun {...props} />;
  }
}
