import { NextRequest, NextResponse } from "next/server";
import { PRODUCTION_API_URL } from "@/lib/api-base";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
  "content-encoding",
]);

async function proxy(
  req: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path } = await ctx.params;
  const target = `${PRODUCTION_API_URL}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  const headers = new Headers();
  for (const [key, value] of req.headers.entries()) {
    if (!HOP.has(key.toLowerCase())) headers.set(key, value);
  }

  headers.set("accept", "application/json");
  headers.set("x-requested-with", "XMLHttpRequest");

  const method = req.method.toUpperCase();
  const body =
    method === "GET" || method === "HEAD" ? undefined : await req.arrayBuffer();

  const res = await fetch(target, {
    method,
    headers,
    body,
    redirect: "manual",
  });

  const out = new Headers();
  for (const [key, value] of res.headers.entries()) {
    if (!HOP.has(key.toLowerCase())) out.set(key, value);
  }
  out.delete("set-cookie");

  return new NextResponse(res.body, { status: res.status, headers: out });
}

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
export const OPTIONS = proxy;
