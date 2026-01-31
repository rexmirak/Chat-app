import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const chatId = url.searchParams.get("chatId");

  if (!q) {
    return NextResponse.json({ messages: [] });
  }

  const memberships = await prisma.chatParticipant.findMany({
    where: { userId: auth.userId },
    select: { chatId: true },
  });

  const chatIds = memberships.map((m) => m.chatId);
  const scopedChatIds = chatId ? chatIds.filter((id) => id === chatId) : chatIds;

  const messages = await prisma.message.findMany({
    where: {
      chatId: { in: scopedChatIds },
      isDeleted: false,
      OR: [{ content: { contains: q } }],
    },
    include: {
      sender: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          isAiBot: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ messages });
}
