"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { fetchUserAvatarSrc } from "@/lib/api";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function UserAvatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    let seq = 0;

    async function load() {
      const current = ++seq;
      const next = await fetchUserAvatarSrc();
      if (cancelled || current !== seq) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      objectUrl = next;
      setSrc(next);
    }

    void load();
    function onUpdate() {
      void load();
    }
    window.addEventListener("genky-avatar", onUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("genky-avatar", onUpdate);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className={clsx("object-cover", className)} />
    );
  }

  return (
    <div
      className={clsx(
        "flex items-center justify-center bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white",
        className,
      )}
    >
      {initialsOf(name)}
    </div>
  );
}
