import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { AppearanceProvider } from "@/components/appearance/AppearanceProvider";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "GENKY — HRM Platform",
  description: "Quản lý nhân sự thế hệ mới",
};

const appearanceBoot = `(function(){try{var raw=localStorage.getItem("genky_appearance");if(!raw)return;var s=JSON.parse(raw);var r=document.documentElement;if(s.primary)r.style.setProperty("--genky-primary",s.primary);if(s.secondary)r.style.setProperty("--genky-secondary",s.secondary);r.dataset.theme=s.mode||"light";r.dataset.sidebar=s.sidebar||"expanded";r.dataset.rounded=s.rounded===false?"0":"1";r.dataset.motion=s.animation===false?"off":"on";}catch(e){}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${plusJakarta.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceBoot }} />
      </head>
      <body className="min-h-full bg-[#F3F4F6] font-sans text-slate-800">
        <AppearanceProvider>{children}</AppearanceProvider>
      </body>
    </html>
  );
}
