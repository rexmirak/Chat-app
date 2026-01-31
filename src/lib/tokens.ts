import crypto from "crypto";
import jwt, { Secret, SignOptions } from "jsonwebtoken";

const JWT_SECRET: Secret = process.env.JWT_SECRET || "change_me";
const ACCESS_TOKEN_TTL = (process.env.ACCESS_TOKEN_TTL || "15m") as SignOptions["expiresIn"];

export function createAccessToken(userId: string) {
  const options: SignOptions = { expiresIn: ACCESS_TOKEN_TTL };
  return jwt.sign({ sub: userId }, JWT_SECRET, options);
}

export function createRefreshToken() {
  return crypto.randomBytes(64).toString("hex");
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function verifyAccessToken(token: string) {
  return jwt.verify(token, JWT_SECRET) as { sub: string };
}
