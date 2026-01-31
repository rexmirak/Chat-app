import { notImplemented } from "@/app/api/_utils";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: Request) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;
  return notImplemented();
}
