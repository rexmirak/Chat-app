import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({
  readAt: z.string().datetime().optional(),
});

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { id: chatId } = await params;
  if (!chatId) {
    return NextResponse.json({ error: "Invalid chat" }, { status: 400 });
  }

  const body = await req.json();
  const input = schema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const readAt = input.data.readAt ? new Date(input.data.readAt) : new Date();

  const result = await prisma.chatParticipant.updateMany({
    where: { chatId, userId: auth.userId },
    data: { lastReadAt: readAt, unreadMark: false },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, readAt: readAt.toISOString() });
}
