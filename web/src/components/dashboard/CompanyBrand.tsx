"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { Briefcase } from "lucide-react";
import { fetchOrganizationLogoSrc } from "@/lib/api";

export function CompanyBrand({
  name,
  collapsed,
}: {
  name: string;
  collapsed?: boolean;
}) {
  const [logoSrc, setLogoSrc] = useState<string | null>(null);
  const label = name?.trim() && name !== "—" ? name : "HRM Pro";

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    let seq = 0;

    async function load() {
      const current = ++seq;
      const src = await fetchOrganizationLogoSrc();
      if (cancelled || current !== seq) {
        if (src) URL.revokeObjectURL(src);
        return;
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = src;
      setLogoSrc(src);
    }

    void load();
    function onUpdate() {
      void load();
    }
    window.addEventListener("genky-logo", onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("genky-logo", onUpdate);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return (
    <div
      className={clsx(
        "flex min-w-0 items-center",
        collapsed ? "justify-center" : "gap-2.5",
      )}
      title={label}
    >
      {logoSrc ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoSrc}
          alt=""
          className="h-9 w-9 rounded-xl object-cover shadow-md shadow-indigo-200"
        />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200">
          <Briefcase className="h-4 w-4 text-white" />
        </div>
      )}
      {collapsed ? null : (
        <span className="truncate text-lg font-bold tracking-tight text-indigo-600">
          {label}
        </span>
      )}
    </div>
  );
}
