import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

const createSchema = z.object({
  participantId: z.string().min(1),
});

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const archivedParam = url.searchParams.get("archived");
  const q = url.searchParams.get("q")?.trim();
  const archived = archivedParam === "true" ? true : archivedParam === "false" ? false : false;

  const chats = await prisma.chat.findMany({
    where: {
      participants: {
        some: { userId: auth.userId, isArchived: archived },
      },
      ...(q
        ? {
            OR: [
              { title: { contains: q } },
              { participants: { some: { user: { displayName: { contains: q } } } } },
              { participants: { some: { user: { username: { contains: q } } } } },
            ],
          }
        : {}),
    },
    include: {
      participants: { include: { user: true } },
      messages: {
        take: 1,
        orderBy: { createdAt: "desc" },
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
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const chatIds = chats.map((chat) => chat.id);
  const unreadByChat = new Map<string, number>();

  if (chatIds.length > 0) {
    const rows = await prisma.$queryRaw<
      Array<{ chatId: string; unreadCount: number }>
    >(Prisma.sql`
      SELECT c.id as chatId, COUNT(m.id) as unreadCount
      FROM Chat c
      JOIN ChatParticipant cp ON cp.chatId = c.id AND cp.userId = ${auth.userId}
      LEFT JOIN Message m ON m.chatId = c.id
        AND m.isDeleted = 0
        AND m.createdAt > COALESCE(MAX(cp.lastReadAt, cp.clearedAt), datetime(0))
      WHERE c.id IN (${Prisma.join(chatIds)})
      GROUP BY c.id
    `);

    rows.forEach((row) => {
      unreadByChat.set(row.chatId, Number(row.unreadCount));
    });
  }

  const payload = chats.map((chat) => {
    const me = chat.participants.find((p) => p.userId === auth.userId);
    const unreadCount = unreadByChat.get(chat.id) ?? 0;
    const lastMessageRaw = chat.messages[0] || null;
    const clearedAt = me?.clearedAt ? new Date(me.clearedAt) : null;
    const lastMessage =
      clearedAt && lastMessageRaw?.createdAt && new Date(lastMessageRaw.createdAt) <= clearedAt
        ? null
        : lastMessageRaw;
    return {
      id: chat.id,
      isGroup: chat.isGroup,
      title: chat.title,
      avatarUrl: chat.avatarUrl,
      updatedAt: chat.updatedAt,
      unreadCount,
      hasUnread: Boolean(me?.unreadMark) || unreadCount > 0,
      me: me
        ? {
            isArchived: me.isArchived,
            isMuted: me.isMuted,
            unreadMark: me.unreadMark,
            lastReadAt: me.lastReadAt,
            clearedAt: me.clearedAt,
          }
        : null,
      participants: chat.participants.map((p) => ({
        id: p.id,
        userId: p.userId,
        role: p.role,
        user: {
          id: p.user.id,
          username: p.user.username,
          displayName: p.user.displayName,
          email: p.user.email,
          avatarUrl: p.user.avatarUrl,
          isAiBot: p.user.isAiBot,
        },
      })),
      lastMessage,
    };
  });

  return NextResponse.json({ chats: payload });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const input = createSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const participantId = input.data.participantId;
  if (participantId === auth.userId) {
    return NextResponse.json({ error: "Invalid participant" }, { status: 400 });
  }

  const participant = await prisma.user.findUnique({ where: { id: participantId } });
  if (!participant) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const existing = await prisma.chat.findFirst({
    where: {
      isGroup: false,
      AND: [
        { participants: { some: { userId: auth.userId } } },
        { participants: { some: { userId: participantId } } },
      ],
    },
    include: { participants: true },
  });

  if (existing && existing.participants.length === 2) {
    return NextResponse.json({ chatId: existing.id });
  }

  const chat = await prisma.chat.create({
    data: {
      isGroup: false,
      participants: {
        create: [{ userId: auth.userId }, { userId: participantId }],
      },
    },
  });

  return NextResponse.json({ chatId: chat.id });
}
