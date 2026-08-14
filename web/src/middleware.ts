import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const forwarded = request.headers.get("x-forwarded-proto");

  if (
    forwarded === "http" &&
    host &&
    !host.startsWith("localhost") &&
    !host.startsWith("127.0.0.1")
  ) {
    const { pathname, search } = request.nextUrl;
    return NextResponse.redirect(`https://${host}${pathname}${search}`, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|backend/).*)"],
};
