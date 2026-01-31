import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { id: chatId } = await params;
  if (!chatId) {
    return NextResponse.json({ error: "Invalid chat" }, { status: 400 });
  }

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (chat.isGroup) {
    const result = await prisma.chatParticipant.deleteMany({
      where: { chatId, userId: auth.userId },
    });
    if (result.count === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ ok: true, scope: "self" });
  }

  const result = await prisma.chatParticipant.updateMany({
    where: { chatId, userId: auth.userId },
    data: { clearedAt: new Date(), isArchived: true, unreadMark: false },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, scope: "self" });
}
