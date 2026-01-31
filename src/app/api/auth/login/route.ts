import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { issueAuthTokens, toPublicUser } from "@/lib/auth";
import { setRefreshCookie } from "@/lib/cookies";

const schema = z.object({
  emailOrUsername: z.string().min(1),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json();
  const input = schema.safeParse(body);

  if (!input.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { emailOrUsername, password } = input.data;
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: emailOrUsername }, { username: emailOrUsername }],
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const { accessToken, refreshToken } = await issueAuthTokens(user.id);
  const res = NextResponse.json({ user: toPublicUser(user), accessToken });
  setRefreshCookie(res, refreshToken);
  return res;
}
