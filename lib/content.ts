import personasData from "@/content/personas.v1.json";
import questionsData from "@/content/questions.v1.json";
import scoringData from "@/content/scoring.v1.json";
import type {
  DimensionConfig,
  PersonaDefinition,
  PersonasContent,
  Question,
  QuestionsContent,
  ScoringContent,
  TrackId
} from "@/lib/types";

export const QUESTIONS = questionsData as unknown as QuestionsContent;
export const SCORING = scoringData as unknown as ScoringContent;
export const PERSONAS = personasData as unknown as PersonasContent;

export const TRACKS: TrackId[] = ["b2b", "b2c"];

export const TRACK_DISPLAY: Record<TrackId, string> = {
  b2b: "B2B SaaS PM",
  b2c: "B2C Consumer PM"
};

export function isTrack(value: string): value is TrackId {
  return TRACKS.includes(value as TrackId);
}

export function getTrackQuestions(track: TrackId) {
  return QUESTIONS.tracks[track];
}

export function getTrackScoring(track: TrackId) {
  return SCORING.tracks[track];
}

export function getQuestionById(track: TrackId, questionId: string): Question | undefined {
  return QUESTIONS.tracks[track].questions.find((question) => question.id === questionId);
}

export function getDimensionForQuestion(track: TrackId, questionId: string): DimensionConfig | undefined {
  return SCORING.tracks[track].dimensions.find((dimension) => dimension.questionIds.includes(questionId));
}

export function findPersonaById(personaId: string): PersonaDefinition | undefined {
  return PERSONAS.personas.find((persona) => persona.id === personaId);
}

export function findPersonaByDimensions(track: TrackId, winners: Record<string, string>) {
  return PERSONAS.personas.find((persona) => {
    if (persona.track !== track) {
      return false;
    }

    return (
      persona.dimensions.d1 === winners.d1 &&
      persona.dimensions.d2 === winners.d2 &&
      persona.dimensions.d3 === winners.d3
    );
  });
}
