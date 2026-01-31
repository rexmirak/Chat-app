import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json({ chats: [] });
  }

  const chats = await prisma.chat.findMany({
    where: {
      participants: { some: { userId: auth.userId } },
      OR: [
        { title: { contains: q } },
        { participants: { some: { user: { displayName: { contains: q } } } } },
        { participants: { some: { user: { username: { contains: q } } } } },
      ],
    },
    include: { participants: { include: { user: true } } },
    take: 20,
  });

  const payload = chats.map((chat) => ({
    id: chat.id,
    isGroup: chat.isGroup,
    title: chat.title,
    avatarUrl: chat.avatarUrl,
    participants: chat.participants.map((p) => ({
      userId: p.userId,
      displayName: p.user.displayName,
      username: p.user.username,
      avatarUrl: p.user.avatarUrl,
    })),
  }));

  return NextResponse.json({ chats: payload });
}
