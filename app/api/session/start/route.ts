import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isTrack } from "@/lib/content";
import { jsonError } from "@/lib/http";
import { withDbMutation } from "@/lib/db";
import type { SessionRecord } from "@/lib/types";

interface StartBody {
  track?: string;
  source?: string;
  previousSessionId?: string;
}

export async function POST(request: Request) {
  let body: StartBody;

  try {
    body = (await request.json()) as StartBody;
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  if (!body.track || !isTrack(body.track)) {
    return jsonError("A valid track is required.", 400);
  }

  const track = body.track;
  const now = new Date().toISOString();
  const sessionId = randomUUID();

  const session = await withDbMutation<SessionRecord>((db) => {
    if (body.previousSessionId) {
      const previous = db.sessions[body.previousSessionId];
      if (previous && previous.status === "in_progress") {
        previous.status = "archived";
        previous.archivedAt = now;
      }
    }

    const record: SessionRecord = {
      id: sessionId,
      track,
      startedAt: now,
      completedAt: null,
      archivedAt: null,
      source: body.source ?? null,
      userAgent: request.headers.get("user-agent"),
      status: "in_progress"
    };

    db.sessions[sessionId] = record;
    db.answers[sessionId] = {};

    return record;
  });

  return NextResponse.json({
    sessionId: session.id,
    track: session.track,
    startedAt: session.startedAt
  });
}
