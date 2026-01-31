import { NextResponse } from "next/server";

export function notImplemented() {
  return NextResponse.json({ error: "Not implemented" }, { status: 501 });
}
