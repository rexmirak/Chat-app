import { NextResponse } from "next/server";
import { getRefreshCookie, setRefreshCookie } from "@/lib/cookies";
import { rotateRefreshToken } from "@/lib/auth";

export async function POST(req: Request) {
  const token = getRefreshCookie(req);
  if (!token) {
    return NextResponse.json({ error: "Missing refresh token" }, { status: 401 });
  }

  const rotated = await rotateRefreshToken(token);
  if (!rotated) {
    return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });
  }

  const res = NextResponse.json({ accessToken: rotated.accessToken });
  setRefreshCookie(res, rotated.refreshToken);
  return res;
}
