import { NextResponse } from "next/server";
import { jsonError } from "@/lib/http";
import { readDb } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, context: Params) {
  const { id } = await context.params;
  const db = await readDb();
  const session = db.sessions[id];

  if (!session) {
    return jsonError("Session not found.", 404);
  }

  return NextResponse.json({
    session,
    answers: db.answers[id] ?? {},
    result: db.results[id] ?? null
  });
}
