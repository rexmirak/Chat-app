import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ muted: z.boolean() });

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const input = schema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { id: chatId } = await params;
  if (!chatId) {
    return NextResponse.json({ error: "Invalid chat" }, { status: 400 });
  }

  const result = await prisma.chatParticipant.updateMany({
    where: { chatId, userId: auth.userId },
    data: { isMuted: input.data.muted },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ chatId, muted: input.data.muted });
}
