export type TrackId = "b2b" | "b2c";
export type Choice = "A" | "B";
export type DimensionId = "d1" | "d2" | "d3";

export interface QuestionOption {
  label: string;
  mapsTo: string;
}

export interface Question {
  id: string;
  prompt: string;
  options: Record<Choice, QuestionOption>;
}

export interface TrackQuestionSet {
  label: string;
  assumptions: string[];
  questions: Question[];
}

export interface QuestionsContent {
  version: string;
  tracks: Record<TrackId, TrackQuestionSet>;
}

export interface DimensionConfig {
  id: DimensionId;
  name: string;
  sides: [string, string];
  questionIds: string[];
  weightOverrides: Record<string, number>;
  tieBreakerQuestionId: string;
  priorWinner: string;
}

export interface TrackScoringConfig {
  dimensions: DimensionConfig[];
  confidenceWeights: Record<DimensionId, number>;
}

export interface ScoringContent {
  version: string;
  confidenceBands: {
    lowMax: number;
    mediumMax: number;
  };
  tracks: Record<TrackId, TrackScoringConfig>;
}

export interface PersonaDefinition {
  id: string;
  track: TrackId;
  name: string;
  summary: string;
  strengths: [string, string, string, string];
  dimensions: Record<DimensionId, string>;
  dimensionLabels: Record<DimensionId, string>;
  confidenceExplanationTemplate: string;
}

export interface PersonasContent {
  version: string;
  personas: PersonaDefinition[];
}

export interface DimensionResult {
  id: DimensionId;
  name: string;
  winner: string;
  scores: Record<string, number>;
  percentages: Record<string, number>;
  certainty: number;
  tieResolvedBy: "score" | "tie_breaker" | "prior";
}

export interface ComputedResult {
  track: TrackId;
  persona: PersonaDefinition;
  dimensions: Record<DimensionId, DimensionResult>;
  confidence: number;
  confidenceBand: "Low" | "Medium" | "High";
}

export interface SessionRecord {
  id: string;
  track: TrackId;
  startedAt: string;
  completedAt: string | null;
  archivedAt: string | null;
  source: string | null;
  userAgent: string | null;
  status: "in_progress" | "completed" | "archived";
}

export interface AnswerRecord {
  questionId: string;
  choice: Choice;
  mappedDimension: DimensionId;
  mappedSide: string;
  weightApplied: number;
  createdAt: string;
}

export interface ResultRecord {
  sessionId: string;
  track: TrackId;
  personaId: string;
  dimensionWinners: Record<DimensionId, string>;
  confidence: number;
  createdAt: string;
  computed: ComputedResult;
}

export interface ShareRecord {
  slug: string;
  sessionId: string;
  createdAt: string;
  views: number;
}

export interface AppDatabase {
  sessions: Record<string, SessionRecord>;
  answers: Record<string, Record<string, AnswerRecord>>;
  results: Record<string, ResultRecord>;
  shares: Record<string, ShareRecord>;
}
