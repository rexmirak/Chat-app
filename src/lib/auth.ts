import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAccessToken, createRefreshToken, hashToken } from "@/lib/tokens";

const REFRESH_TTL_DAYS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || "30");

export type PublicUser = Pick<
  User,
  "id" | "email" | "username" | "displayName" | "avatarUrl" | "bio" | "createdAt" | "updatedAt" | "isAiBot"
>;

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    isAiBot: user.isAiBot,
  };
}

export async function issueAuthTokens(userId: string) {
  const accessToken = createAccessToken(userId);
  const refreshToken = createRefreshToken();
  const refreshTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  const session = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: refreshTokenHash,
      expiresAt,
    },
  });

  return { accessToken, refreshToken, refreshTokenId: session.id };
}

export async function rotateRefreshToken(oldToken: string) {
  const oldHash = hashToken(oldToken);
  const existing = await prisma.refreshToken.findFirst({
    where: { tokenHash: oldHash, revokedAt: null },
  });

  if (!existing || existing.expiresAt < new Date()) {
    return null;
  }

  const { accessToken, refreshToken, refreshTokenId } = await issueAuthTokens(existing.userId);

  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date(), replacedById: refreshTokenId },
  });

  return { accessToken, refreshToken, userId: existing.userId };
}

export async function revokeRefreshToken(token: string) {
  const tokenHash = hashToken(token);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
