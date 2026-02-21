import { NextResponse } from "next/server";
import { getTrackQuestions } from "@/lib/content";
import { withDbMutation } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { computeResult } from "@/lib/scoring";
import type { Choice, ResultRecord } from "@/lib/types";

interface Params {
  params: Promise<{ id: string }>;
}

interface CompletionMutationSuccess {
  status: 200;
  payload: {
    sessionId: string;
    result: ResultRecord;
    resultUrl: string;
  };
}

interface CompletionMutationFailure {
  error: string;
  status: 400 | 404 | 409;
}

type CompletionMutationResult = CompletionMutationSuccess | CompletionMutationFailure;

export async function POST(_request: Request, context: Params) {
  const { id: sessionId } = await context.params;

  const result = await withDbMutation<CompletionMutationResult>((db) => {
    const session = db.sessions[sessionId];

    if (!session) {
      return { error: "Session not found.", status: 404 as const };
    }

    if (session.status === "archived") {
      return { error: "Session was archived after track switch.", status: 409 as const };
    }

    if (session.status === "completed" && db.results[sessionId]) {
      return {
        status: 200 as const,
        payload: {
          sessionId,
          result: db.results[sessionId],
          resultUrl: `/result/${sessionId}`
        }
      };
    }

    const answerMap = db.answers[sessionId] ?? {};
    const answers = Object.values(answerMap).reduce<Record<string, Choice>>((acc, answer) => {
      acc[answer.questionId] = answer.choice;
      return acc;
    }, {});

    const totalRequired = getTrackQuestions(session.track).questions.length;
    if (Object.keys(answers).length < totalRequired) {
      return {
        error: `All ${totalRequired} answers are required before completion.`,
        status: 400 as const
      };
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

    db.results[sessionId] = record;
    session.status = "completed";
    session.completedAt = now;

    return {
      status: 200 as const,
      payload: {
        sessionId,
        result: record,
        resultUrl: `/result/${sessionId}`
      }
    };
  });

  if ("error" in result) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json(result.payload, { status: result.status });
}
