import { NextResponse } from "next/server";
import { getDimensionForQuestion, getQuestionById } from "@/lib/content";
import { jsonError } from "@/lib/http";
import { withDbMutation } from "@/lib/db";
import type { Choice, DimensionId } from "@/lib/types";

interface Params {
  params: Promise<{ id: string }>;
}

interface AnswerBody {
  questionId?: string;
  choice?: Choice;
}

interface AnswerMutationSuccess {
  ok: true;
  status: 200;
  payload: {
    questionId: string;
    choice: Choice;
    mappedDimension: DimensionId;
    mappedSide: string;
    weightApplied: number;
    updatedAt: string;
  };
}

interface AnswerMutationFailure {
  error: string;
  status: 400 | 404 | 409;
}

type AnswerMutationResult = AnswerMutationSuccess | AnswerMutationFailure;

function isChoice(value: string): value is Choice {
  return value === "A" || value === "B";
}

export async function POST(request: Request, context: Params) {
  const { id: sessionId } = await context.params;

  let body: AnswerBody;
  try {
    body = (await request.json()) as AnswerBody;
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  if (!body.questionId || !body.choice || !isChoice(body.choice)) {
    return jsonError("questionId and choice are required.", 400);
  }

  const questionId = body.questionId;
  const choice = body.choice;

  const result = await withDbMutation<AnswerMutationResult>((db) => {
    const session = db.sessions[sessionId];

    if (!session) {
      return { error: "Session not found.", status: 404 as const };
    }

    if (session.status !== "in_progress") {
      return { error: "Session is not in progress.", status: 409 as const };
    }

    const question = getQuestionById(session.track, questionId);
    const dimension = getDimensionForQuestion(session.track, questionId);

    if (!question || !dimension) {
      return { error: "Unknown question for this track.", status: 400 as const };
    }

    const option = question.options[choice];
    const weightApplied = dimension.weightOverrides[questionId] ?? 1;
    const now = new Date().toISOString();

    db.answers[sessionId] = db.answers[sessionId] ?? {};
    db.answers[sessionId][questionId] = {
      questionId,
      choice,
      mappedDimension: dimension.id as DimensionId,
      mappedSide: option.mapsTo,
      weightApplied,
      createdAt: now
    };

    return {
      ok: true,
      status: 200 as const,
      payload: {
        questionId,
        choice,
        mappedDimension: dimension.id,
        mappedSide: option.mapsTo,
        weightApplied,
        updatedAt: now
      }
    };
  });

  if ("error" in result) {
    return jsonError(result.error, result.status);
  }

  return NextResponse.json(result.payload, { status: result.status });
}
