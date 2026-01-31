import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { toPublicUser } from "@/lib/auth";

const updateSchema = z.object({
  displayName: z.string().min(1).optional(),
  avatarUrl: z.string().url().optional().nullable(),
  bio: z.string().max(500).optional().nullable(),
});

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const user = await prisma.user.findUnique({ where: { id: auth.userId } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user: toPublicUser(user) });
}

export async function PATCH(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const input = updateSchema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: auth.userId },
    data: input.data,
  });

  return NextResponse.json({ user: toPublicUser(user) });
}
