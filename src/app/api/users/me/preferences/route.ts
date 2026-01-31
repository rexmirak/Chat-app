import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { toPublicUser } from "@/lib/auth";

const schema = z.object({
  notificationsOn: z.boolean().optional(),
});

export async function PATCH(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const body = await req.json();
  const input = schema.safeParse(body);
  if (!input.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const user = await prisma.user.update({
    where: { id: auth.userId },
    data: input.data,
  });

  return NextResponse.json({ user: toPublicUser(user) });
}
