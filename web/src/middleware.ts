import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");

  if (
    proto === "http" &&
    host &&
    !host.startsWith("localhost") &&
    !host.startsWith("127.0.0.1")
  ) {
    const url = request.nextUrl.clone();
    url.protocol = "https:";
    url.host = host;
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|backend/).*)"],
};
