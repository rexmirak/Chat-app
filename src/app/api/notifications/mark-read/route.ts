import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  let ids: string[] | null = null;
  try {
    const body = await req.json();
    if (Array.isArray(body?.ids)) {
      ids = body.ids;
    }
  } catch {
    ids = null;
  }

  if (ids && ids.length > 0) {
    await prisma.notification.updateMany({
      where: {
        userId: auth.userId,
        id: { in: ids }
      },
      data: { isRead: true }
    });
  } else {
    await prisma.notification.updateMany({
      where: {
        userId: auth.userId,
        isRead: false
      },
      data: { isRead: true }
    });
  }

  return NextResponse.json({ ok: true });
}
