"use client";

import clsx from "clsx";
import { employeeAvatarSrc } from "@/lib/avatar";

export function EmployeeAvatar({
  avatar,
  name,
  code,
  className,
  alt = "",
}: {
  avatar?: string | null;
  name?: string | null;
  code?: string | null;
  className?: string;
  alt?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={employeeAvatarSrc({ avatar, name, code })}
      alt={alt}
      className={clsx("object-cover", className)}
    />
  );
}
