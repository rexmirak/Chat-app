import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_PATHS = new Set([
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/refresh",
  "/api/auth/logout",
]);

function base64UrlToUint8(input: string) {
  const base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  const binary = atob(base64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeJson<T>(input: string) {
  const bytes = base64UrlToUint8(input);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}

async function verifyJwt(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, signatureB64] = parts;

  const header = decodeJson<{ alg?: string }>(headerB64);
  if (header.alg !== "HS256") return null;

  const payload = decodeJson<{ exp?: number; sub?: string }>(payloadB64);
  if (!payload.sub) return null;
  if (payload.exp && Date.now() >= payload.exp * 1000) return null;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const data = encoder.encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlToUint8(signatureB64);
  const ok = await crypto.subtle.verify("HMAC", key, signature, data);
  if (!ok) return null;

  return payload;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (AUTH_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  if (req.method === "OPTIONS") {
    return NextResponse.next();
  }

  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = process.env.JWT_SECRET || "";
  if (!secret) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const payload = await verifyJwt(match[1], secret);
  if (!payload) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
