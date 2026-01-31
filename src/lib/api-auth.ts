import { NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/tokens";

export async function requireAuth(req: Request): Promise<
  | { userId: string }
  | { error: NextResponse }
> {
  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  try {
    const payload = verifyAccessToken(match[1]);
    return { userId: payload.sub };
  } catch {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}
