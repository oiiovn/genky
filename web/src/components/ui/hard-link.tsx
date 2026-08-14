import type { AnchorHTMLAttributes } from "react";

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  locale?: string | false;
};

/** LiteSpeed hay trả HTML cho request RSC của next/link → mọi menu vỡ. Dùng <a> full load. */
export default function Link({
  href,
  prefetch: _prefetch,
  replace: _replace,
  scroll: _scroll,
  locale: _locale,
  ...props
}: LinkProps) {
  return <a href={href} {...props} />;
}
