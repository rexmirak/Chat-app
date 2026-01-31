import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { issueAuthTokens, toPublicUser } from "@/lib/auth";
import { setRefreshCookie } from "@/lib/cookies";

const schema = z.object({
  email: z.string().email(),
  username: z.string().min(3),
  password: z.string().min(8),
  displayName: z.string().min(1),
});

export async function POST(req: Request) {
  const body = await req.json();
  const input = schema.safeParse(body);

  if (!input.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { email, username, password, displayName } = input.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
  });

  if (existing) {
    return NextResponse.json({ error: "Email or username already in use" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { email, username, passwordHash, displayName },
  });

  const { accessToken, refreshToken } = await issueAuthTokens(user.id);
  const res = NextResponse.json({ user: toPublicUser(user), accessToken });
  setRefreshCookie(res, refreshToken);
  return res;
}
