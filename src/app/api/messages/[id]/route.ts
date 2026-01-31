import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: Params) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { id: messageId } = await params;
  if (!messageId) {
    return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  }

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (message.senderId !== auth.userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.message.update({
    where: { id: messageId },
    data: { isDeleted: true },
  });

  return NextResponse.json({ ok: true });
}
