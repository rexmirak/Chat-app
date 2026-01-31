import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

const AI_EMAIL = "ai-bot@system.local";
const AI_USERNAME = "ai_bot";
const AI_NAME = "CH Assistant";
const AI_AVATAR = "/avatars/person.png";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();

  const existingAi = await prisma.user.findUnique({ where: { email: AI_EMAIL } });
  if (!existingAi) {
    const passwordHash = await hashPassword("ai-bot");
    await prisma.user.create({
      data: {
        email: AI_EMAIL,
        username: AI_USERNAME,
        passwordHash,
        displayName: AI_NAME,
        isAiBot: true,
        avatarUrl: AI_AVATAR,
      },
    });
  } else if (!existingAi.isAiBot || existingAi.displayName !== AI_NAME || existingAi.avatarUrl !== AI_AVATAR) {
    await prisma.user.update({
      where: { id: existingAi.id },
      data: {
        isAiBot: true,
        displayName: AI_NAME,
        avatarUrl: AI_AVATAR,
      },
    });
  }

  const users = await prisma.user.findMany({
    where: {
      id: { not: auth.userId },
      ...(q
        ? {
            OR: [
              { displayName: { contains: q } },
              { username: { contains: q } },
              { email: { contains: q } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  const payload = users.map((user) => ({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    isAiBot: user.isAiBot,
    lastSeenAt: user.lastSeenAt,
  }));

  return NextResponse.json({ users: payload });
}
