import { NextResponse } from "next/server";

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }

  return headers.get("x-real-ip") ?? "unknown";
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
