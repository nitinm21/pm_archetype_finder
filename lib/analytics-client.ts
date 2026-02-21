export type AnalyticsEventName =
  | "landing_viewed"
  | "track_selected"
  | "quiz_started"
  | "question_answered"
  | "quiz_completed"
  | "result_viewed"
  | "result_shared"
  | "track_switched"
  | "retake_clicked";

const STORAGE_KEY = "pm-persona:v1:analytics-events";

interface AnalyticsEvent {
  name: AnalyticsEventName;
  payload: Record<string, unknown>;
  timestamp: string;
}

export function trackEvent(name: AnalyticsEventName, payload: Record<string, unknown> = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const event: AnalyticsEvent = {
    name,
    payload,
    timestamp: new Date().toISOString()
  };

  const existingRaw = window.localStorage.getItem(STORAGE_KEY);
  const existing = existingRaw ? (JSON.parse(existingRaw) as AnalyticsEvent[]) : [];
  const next = [...existing, event].slice(-500);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.info("[analytics]", event.name, event.payload);
  }
}
