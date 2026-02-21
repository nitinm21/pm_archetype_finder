import { NextResponse } from "next/server";
import { getTrackQuestions } from "@/lib/content";
import { readDb, withDbMutation } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { computeResult } from "@/lib/scoring";
import type { Choice, ResultRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ sessionId: string }>;
}

export async function GET(_request: Request, context: Params) {
  const { sessionId } = await context.params;
  const db = await readDb();

  const session = db.sessions[sessionId];
  if (!session) {
    return jsonError("Session not found.", 404);
  }

  const cached = db.results[sessionId];
  if (cached) {
    return NextResponse.json({ session, result: cached });
  }

  const answerMap = db.answers[sessionId] ?? {};
  const answers = Object.values(answerMap).reduce<Record<string, Choice>>((acc, answer) => {
    acc[answer.questionId] = answer.choice;
    return acc;
  }, {});

  const totalRequired = getTrackQuestions(session.track).questions.length;
  if (Object.keys(answers).length < totalRequired) {
    return jsonError("Result is not ready. Finish the quiz first.", 409);
  }

  const stored = await withDbMutation((mutableDb) => {
    const mutableSession = mutableDb.sessions[sessionId];
    if (!mutableSession) {
      throw new Error("Session disappeared during result creation.");
    }

    const computed = computeResult(session.track, answers);
    const now = new Date().toISOString();

    const record: ResultRecord = {
      sessionId,
      track: session.track,
      personaId: computed.persona.id,
      dimensionWinners: {
        d1: computed.dimensions.d1.winner,
        d2: computed.dimensions.d2.winner,
        d3: computed.dimensions.d3.winner
      },
      confidence: computed.confidence,
      createdAt: now,
      computed
    };

    mutableDb.results[sessionId] = record;
    mutableSession.status = "completed";
    mutableSession.completedAt = now;

    return record;
  });

  return NextResponse.json({ session, result: stored });
}
