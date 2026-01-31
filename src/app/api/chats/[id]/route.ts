import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { id: chatId } = await params;
  if (!chatId) {
    return NextResponse.json({ error: "Invalid chat" }, { status: 400 });
  }

  const body = await req.json();
  const input = updateSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const participant = await prisma.chatParticipant.findUnique({
    where: { chatId_userId: { chatId, userId: auth.userId } },
  });

  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat || !chat.isGroup) {
    return NextResponse.json({ error: "Group chat required" }, { status: 400 });
  }

  if (participant.role !== "admin" && participant.role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.chat.update({
    where: { id: chatId },
    data: input.data,
  });

  return NextResponse.json({ chat: updated });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { id: chatId } = await params;
  if (!chatId) {
    return NextResponse.json({ error: "Invalid chat" }, { status: 400 });
  }

  const participant = await prisma.chatParticipant.findUnique({
    where: { chatId_userId: { chatId, userId: auth.userId } },
  });

  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const chat = await prisma.chat.findUnique({ where: { id: chatId } });
  if (!chat) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (chat.isGroup) {
    if (participant.role !== "admin" && participant.role !== "owner") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    await prisma.$transaction([
      prisma.attachment.deleteMany({ where: { message: { chatId } } }),
      prisma.message.deleteMany({ where: { chatId } }),
      prisma.chatParticipant.deleteMany({ where: { chatId } }),
      prisma.chat.delete({ where: { id: chatId } }),
    ]);
    return NextResponse.json({ ok: true });
  }

  await prisma.chatParticipant.update({
    where: { chatId_userId: { chatId, userId: auth.userId } },
    data: { clearedAt: new Date(), isArchived: true, unreadMark: false },
  });

  return NextResponse.json({ ok: true });
}
