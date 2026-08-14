import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { StaffShell } from "@/components/staff/StaffShell";

export const metadata: Metadata = {
  title: "Genky Staff",
  description: "Ứng dụng nhân viên Genky",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Genky Staff",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0B1220",
};

export default function StaffLayout({ children }: { children: ReactNode }) {
  return <StaffShell>{children}</StaffShell>;
}
