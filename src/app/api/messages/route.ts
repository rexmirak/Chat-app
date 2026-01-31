import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  chatId: z.string().min(1),
  type: z.enum(["TEXT", "MEDIA", "DOC", "LINK", "SYSTEM", "AI"]),
  content: z.string().optional().nullable(),
  attachments: z
    .array(
      z.object({
        type: z.enum(["IMAGE", "VIDEO", "AUDIO", "DOC", "OTHER"]),
        url: z.string().min(1),
        filename: z.string().min(1),
        sizeBytes: z.number().int().nonnegative(),
        mimeType: z.string().min(1),
        width: z.number().int().optional().nullable(),
        height: z.number().int().optional().nullable(),
        durationMs: z.number().int().optional().nullable(),
      }),
    )
    .optional(),
});

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const input = schema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { chatId, type, content, attachments } = input.data;
  const participant = await prisma.chatParticipant.findUnique({
    where: { chatId_userId: { chatId, userId: auth.userId } },
  });

  if (!participant) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const message = await prisma.message.create({
    data: {
      chatId,
      senderId: auth.userId,
      type,
      content: content || null,
      attachments: attachments?.length
        ? {
            create: attachments.map((a) => ({
              type: a.type,
              url: a.url,
              filename: a.filename,
              sizeBytes: a.sizeBytes,
              mimeType: a.mimeType,
              width: a.width ?? null,
              height: a.height ?? null,
              durationMs: a.durationMs ?? null,
            })),
          }
        : undefined,
    },
    include: {
      attachments: true,
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
  });

  await prisma.chat.update({
    where: { id: chatId },
    data: { updatedAt: new Date() },
  });

  await prisma.chatParticipant.updateMany({
    where: { chatId, userId: auth.userId },
    data: { lastReadAt: message.createdAt, unreadMark: false },
  });

  return NextResponse.json({ message });
}
