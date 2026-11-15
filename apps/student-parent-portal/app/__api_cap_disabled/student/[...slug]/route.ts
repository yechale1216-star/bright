import { NextRequest, NextResponse } from "next/server";
import { getApiUrl } from "@/lib/api-config";

const BACKEND_URL = getApiUrl();

async function proxyHandler(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const resolvedParams = await params;
  const path = resolvedParams.slug.join("/");
  const url = new URL(req.url);
  const targetUrl = `${BACKEND_URL}/api/student/${path}${url.search}`;

  const headers = new Headers();
  req.headers.forEach((value, key) => {
    // Avoid host header mismatch
    if (key.toLowerCase() !== "host") {
      headers.set(key, value);
    }
  });

  const cookie = req.headers.get("cookie");
  if (cookie) {
    headers.set("cookie", cookie);
  }

  const auth = req.headers.get("authorization");
  if (auth) {
    headers.set("authorization", auth);
  }

  let body: any = undefined;
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    try {
      body = await req.text();
    } catch {}
  }

  try {
    const res = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      // @ts-ignore
      duplex: "half",
    });

    const responseHeaders = new Headers();
    res.headers.forEach((val, key) => {
      if (key.toLowerCase() !== "content-encoding") {
        responseHeaders.set(key, val);
      }
    });

    const data = await res.arrayBuffer();
    return new NextResponse(data, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    console.error(`[StudentProxyError] Failed to forward to ${targetUrl}:`, err);
    return NextResponse.json(
      { success: false, message: "Backend service unreachable" },
      { status: 502 }
    );
  }
}

export const GET = proxyHandler;
export const POST = proxyHandler;
export const PUT = proxyHandler;
export const PATCH = proxyHandler;
export const DELETE = proxyHandler;
