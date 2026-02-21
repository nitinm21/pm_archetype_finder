import type { Choice, TrackId } from "@/lib/types";

const STORAGE_PREFIX = "pm-persona:v1";

export interface LocalSessionSnapshot {
  sessionId: string;
  track: TrackId;
  answers: Record<string, Choice>;
  startedAt: string;
  completedAt: string | null;
}

function keyForSession(sessionId: string) {
  return `${STORAGE_PREFIX}:session:${sessionId}`;
}

function safeParse<T>(value: string | null): T | null {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function getStoredSelectedTrack(): TrackId | null {
  if (typeof window === "undefined") {
    return null;
  }

  return safeParse<TrackId>(window.localStorage.getItem(`${STORAGE_PREFIX}:selected-track`));
}

export function setStoredSelectedTrack(track: TrackId) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(`${STORAGE_PREFIX}:selected-track`, JSON.stringify(track));
}

export function getActiveSessionId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  return safeParse<string>(window.localStorage.getItem(`${STORAGE_PREFIX}:active-session`));
}

export function setActiveSessionId(sessionId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(`${STORAGE_PREFIX}:active-session`, JSON.stringify(sessionId));
}

export function saveLocalSession(snapshot: LocalSessionSnapshot) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(keyForSession(snapshot.sessionId), JSON.stringify(snapshot));
  setActiveSessionId(snapshot.sessionId);
  setStoredSelectedTrack(snapshot.track);
}

export function getLocalSession(sessionId: string): LocalSessionSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  return safeParse<LocalSessionSnapshot>(window.localStorage.getItem(keyForSession(sessionId)));
}

export function getLatestSessionForTrack(track: TrackId): LocalSessionSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  const activeSessionId = getActiveSessionId();
  if (!activeSessionId) {
    return null;
  }

  const snapshot = getLocalSession(activeSessionId);
  if (!snapshot || snapshot.track !== track) {
    return null;
  }

  return snapshot;
}

export function updateLocalAnswer(sessionId: string, questionId: string, choice: Choice) {
  const existing = getLocalSession(sessionId);
  if (!existing) {
    return;
  }

  const updated: LocalSessionSnapshot = {
    ...existing,
    answers: {
      ...existing.answers,
      [questionId]: choice
    }
  };

  saveLocalSession(updated);
}

export function markLocalSessionCompleted(sessionId: string) {
  const existing = getLocalSession(sessionId);
  if (!existing) {
    return;
  }

  saveLocalSession({
    ...existing,
    completedAt: new Date().toISOString()
  });
}
