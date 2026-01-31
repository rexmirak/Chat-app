import { NextResponse } from "next/server";
import { clearRefreshCookie, getRefreshCookie } from "@/lib/cookies";
import { revokeRefreshToken } from "@/lib/auth";

export async function POST(req: Request) {
  const token = getRefreshCookie(req);
  if (token) {
    await revokeRefreshToken(token);
  }

  const res = NextResponse.json({ ok: true });
  clearRefreshCookie(res);
  return res;
}
