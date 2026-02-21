import { findPersonaByDimensions, getTrackQuestions, getTrackScoring, SCORING } from "@/lib/content";
import type {
  Choice,
  ComputedResult,
  DimensionId,
  DimensionResult,
  PersonaDefinition,
  Question,
  TrackId
} from "@/lib/types";

function getQuestionMap(track: TrackId): Record<string, Question> {
  const questions = getTrackQuestions(track).questions;
  return questions.reduce<Record<string, Question>>((acc, question) => {
    acc[question.id] = question;
    return acc;
  }, {});
}

function getConfidenceBand(confidence: number): "Low" | "Medium" | "High" {
  if (confidence <= SCORING.confidenceBands.lowMax) {
    return "Low";
  }

  if (confidence <= SCORING.confidenceBands.mediumMax) {
    return "Medium";
  }

  return "High";
}

function computeDimension(
  questionMap: Record<string, Question>,
  dimension: {
    id: DimensionId;
    name: string;
    sides: [string, string];
    questionIds: string[];
    weightOverrides: Record<string, number>;
    tieBreakerQuestionId: string;
    priorWinner: string;
  },
  answers: Record<string, Choice>
): DimensionResult {
  const [sideA, sideB] = dimension.sides;
  let scoreA = 0;
  let scoreB = 0;

  for (const questionId of dimension.questionIds) {
    const choice = answers[questionId];
    if (!choice) {
      continue;
    }

    const question = questionMap[questionId];
    const option = question?.options[choice];
    if (!option) {
      continue;
    }

    const weight = dimension.weightOverrides[questionId] ?? 1;

    if (option.mapsTo === sideA) {
      scoreA += weight;
    } else if (option.mapsTo === sideB) {
      scoreB += weight;
    }
  }

  let winner = sideA;
  let tieResolvedBy: DimensionResult["tieResolvedBy"] = "score";

  if (scoreB > scoreA) {
    winner = sideB;
  } else if (scoreA === scoreB) {
    const tieBreakChoice = answers[dimension.tieBreakerQuestionId];
    const tieBreakOption = tieBreakChoice
      ? questionMap[dimension.tieBreakerQuestionId]?.options[tieBreakChoice]
      : undefined;

    if (tieBreakOption?.mapsTo === sideA || tieBreakOption?.mapsTo === sideB) {
      winner = tieBreakOption.mapsTo;
      tieResolvedBy = "tie_breaker";
    } else {
      winner = dimension.priorWinner;
      tieResolvedBy = "prior";
    }
  }

  const total = scoreA + scoreB;
  const margin = total > 0 ? Math.abs(scoreA - scoreB) / total : 0;
  const certainty = Math.round(50 + 50 * margin);

  const percentA = total > 0 ? Math.round((100 * scoreA) / total) : 50;
  const percentB = 100 - percentA;

  return {
    id: dimension.id,
    name: dimension.name,
    winner,
    scores: {
      [sideA]: scoreA,
      [sideB]: scoreB
    },
    percentages: {
      [sideA]: percentA,
      [sideB]: percentB
    },
    certainty,
    tieResolvedBy
  };
}

export function computeResult(track: TrackId, answers: Record<string, Choice>): ComputedResult {
  const scoring = getTrackScoring(track);
  const questionMap = getQuestionMap(track);

  const dimensions = scoring.dimensions.reduce<Record<DimensionId, DimensionResult>>((acc, dimension) => {
    acc[dimension.id] = computeDimension(questionMap, dimension, answers);
    return acc;
  }, {} as Record<DimensionId, DimensionResult>);

  const winners: Record<string, string> = {
    d1: dimensions.d1.winner,
    d2: dimensions.d2.winner,
    d3: dimensions.d3.winner
  };

  const persona = findPersonaByDimensions(track, winners);
  if (!persona) {
    throw new Error(`No persona mapping found for ${track} dimensions: ${JSON.stringify(winners)}`);
  }

  const weightedConfidence =
    dimensions.d1.certainty * scoring.confidenceWeights.d1 +
    dimensions.d2.certainty * scoring.confidenceWeights.d2 +
    dimensions.d3.certainty * scoring.confidenceWeights.d3;

  const confidence = Math.round(weightedConfidence);

  return {
    track,
    persona: persona as PersonaDefinition,
    dimensions,
    confidence,
    confidenceBand: getConfidenceBand(confidence)
  };
}
