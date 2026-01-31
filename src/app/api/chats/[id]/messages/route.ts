import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { id: chatId } = await params;

  // Verify membership
  const membership = await prisma.chatParticipant.findUnique({
    where: {
      chatId_userId: {
        chatId,
        userId: auth.userId,
      },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Fetch messages
  const messages = await prisma.message.findMany({
    where: {
      chatId,
      isDeleted: false,
      ...(membership.clearedAt
        ? {
            createdAt: {
              gt: membership.clearedAt,
            },
          }
        : {}),
    },
    orderBy: { createdAt: "asc" },
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
      attachments: true,
    },
  });

  return NextResponse.json({ messages });
}
