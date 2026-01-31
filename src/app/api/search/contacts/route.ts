import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ users: [] });
  }

  const users = await prisma.user.findMany({
    where: {
      id: { not: auth.userId },
      OR: [
        { displayName: { contains: q } },
        { username: { contains: q } },
        { email: { contains: q } },
      ],
    },
    take: 20,
  });

  return NextResponse.json({
    users: users.map((user) => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      isAiBot: user.isAiBot,
    })),
  });
}
