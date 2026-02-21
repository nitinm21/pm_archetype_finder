"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PageTransition } from "@/components/page-transition";
import { getTrackQuestions, isTrack } from "@/lib/content";
import { trackEvent } from "@/lib/analytics-client";
import {
  getActiveSessionId,
  getLatestSessionForTrack,
  getLocalSession,
  getStoredSelectedTrack,
  markLocalSessionCompleted,
  removeLocalSession,
  saveLocalSession,
  updateLocalAnswer,
  type LocalSessionSnapshot
} from "@/lib/session-client";
import type { Choice, TrackId } from "@/lib/types";

interface QuizPageProps {
  params: {
    track: string;
  };
}

interface StartSessionResponse {
  sessionId: string;
  startedAt: string;
}

const SELECTION_CONFIRM_MS = 500;

function isChoice(value: string): value is Choice {
  return value === "A" || value === "B";
}

export default function QuizTrackPage({ params }: QuizPageProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const searchParams = useSearchParams();
  const forceRetake = searchParams.get("retake") === "1";
  const validTrack = isTrack(params.track);
  const track: TrackId = validTrack ? (params.track as TrackId) : "b2b";
  const content = useMemo(() => getTrackQuestions(track), [track]);
  const questions = content.questions;

  const [initializing, setInitializing] = useState(true);
  const [blockedByGate, setBlockedByGate] = useState(false);
  const [mode, setMode] = useState<"start" | "resume" | "completed">("start");
  const [snapshot, setSnapshot] = useState<LocalSessionSnapshot | null>(null);

  const [started, setStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, Choice>>({});
  const [currentIndex, setCurrentIndex] = useState(0);

  const [isStarting, setIsStarting] = useState(false);
  const [, setIsSyncing] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isAdvancingChoice, setIsAdvancingChoice] = useState(false);
  const [, setUnsyncedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const questionShownAt = useRef<number>(Date.now());
  const onSelectChoiceRef = useRef<(choice: Choice) => void>(() => undefined);

  useEffect(() => {
    if (!validTrack) {
      return;
    }

    const selectedTrack = getStoredSelectedTrack();
    if (!selectedTrack || selectedTrack !== track) {
      setBlockedByGate(true);
      setInitializing(false);
      return;
    }

    if (forceRetake) {
      setInitializing(false);
      setMode("start");
      setSnapshot(null);
      return;
    }

    const existing = getLatestSessionForTrack(track);
    if (!existing) {
      setInitializing(false);
      return;
    }

    if (existing.completedAt) {
      setSnapshot(existing);
      setMode("completed");
      setInitializing(false);
    } else {
      setMode("resume");

      void (async () => {
        try {
          const response = await fetch(`/api/session/${existing.sessionId}`, { cache: "no-store" });
          if (!response.ok) {
            removeLocalSession(existing.sessionId);
            setSnapshot(null);
            setSessionId(null);
            setAnswers({});
            setCurrentIndex(0);
            setStarted(false);
            setMode("start");
            setError("Your previous local draft is no longer on the server. Start a fresh assessment.");
            return;
          }

          const nextIndex = questions.findIndex((question) => !existing.answers[question.id]);
          setSnapshot(existing);
          setSessionId(existing.sessionId);
          setAnswers(existing.answers);
          setCurrentIndex(nextIndex === -1 ? questions.length - 1 : nextIndex);
          setStarted(true);
        } catch {
          const nextIndex = questions.findIndex((question) => !existing.answers[question.id]);
          setSnapshot(existing);
          setSessionId(existing.sessionId);
          setAnswers(existing.answers);
          setCurrentIndex(nextIndex === -1 ? questions.length - 1 : nextIndex);
          setStarted(true);
        } finally {
          setInitializing(false);
        }
      })();

      return;
    }
  }, [validTrack, track, forceRetake, questions]);

  useEffect(() => {
    questionShownAt.current = Date.now();
  }, [currentIndex]);

  const progressPercent = Math.round((Object.keys(answers).length / questions.length) * 100);
  const activeQuestion = questions[currentIndex];
  const currentChoice = activeQuestion ? answers[activeQuestion.id] : undefined;

  const addUnsynced = (questionId: string) => {
    setUnsyncedIds((previous) => (previous.includes(questionId) ? previous : [...previous, questionId]));
  };

  const clearUnsynced = (questionId: string) => {
    setUnsyncedIds((previous) => previous.filter((value) => value !== questionId));
  };

  const syncSingleAnswer = async (sid: string, questionId: string, choice: Choice) => {
    const response = await fetch(`/api/session/${sid}/answer`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ questionId, choice })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Unable to sync answer.");
    }
  };

  const syncAllAnswers = async (sid: string, answerMap: Record<string, Choice>) => {
    const failed: string[] = [];

    setIsSyncing(true);

    for (const [questionId, choice] of Object.entries(answerMap)) {
      if (!isChoice(choice)) {
        continue;
      }

      try {
        await syncSingleAnswer(sid, questionId, choice);
      } catch {
        failed.push(questionId);
      }
    }

    setIsSyncing(false);
    setUnsyncedIds(failed);

    if (failed.length > 0) {
      throw new Error("Some answers could not be synced. Retry and your local progress will be preserved.");
    }
  };

  const completeQuiz = async (sid: string, answerMap: Record<string, Choice>) => {
    if (isCompleting) {
      return;
    }

    setIsCompleting(true);
    setError(null);

    try {
      await syncAllAnswers(sid, answerMap);

      const completeResponse = await fetch(`/api/session/${sid}/complete`, {
        method: "POST"
      });

      if (!completeResponse.ok) {
        const data = (await completeResponse.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not finalize the assessment.");
      }

      markLocalSessionCompleted(sid);
      trackEvent("quiz_completed", { track, session_id: sid });
      router.push(`/result/${sid}`);
    } catch (completionError) {
      setError(completionError instanceof Error ? completionError.message : "Could not complete quiz.");
    } finally {
      setIsCompleting(false);
    }
  };

  const requestNewSession = async (previousSessionId?: string): Promise<StartSessionResponse> => {
    const response = await fetch("/api/session/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        track,
        source: "web",
        previousSessionId
      })
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(data?.error ?? "Could not start session.");
    }

    return (await response.json()) as StartSessionResponse;
  };

  const startNewSession = async () => {
    setIsStarting(true);
    setError(null);

    try {
      const previousSessionId = getActiveSessionId();
      const previousSnapshot = previousSessionId ? getLocalSession(previousSessionId) : null;
      const shouldArchive = Boolean(previousSnapshot && previousSnapshot.completedAt === null);

      const data = await requestNewSession(shouldArchive ? previousSessionId ?? undefined : undefined);

      if (previousSnapshot && previousSnapshot.track !== track) {
        trackEvent("track_switched", {
          from_track: previousSnapshot.track,
          to_track: track
        });
      }

      setSessionId(data.sessionId);
      setAnswers({});
      setCurrentIndex(0);
      setStarted(true);
      setUnsyncedIds([]);
      setSnapshot(null);

      saveLocalSession({
        sessionId: data.sessionId,
        track,
        answers: {},
        startedAt: data.startedAt,
        completedAt: null
      });

      trackEvent("quiz_started", {
        track,
        session_id: data.sessionId,
        resumed: false
      });
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : "Could not start session.");
    } finally {
      setIsStarting(false);
    }
  };

  const resumeSession = () => {
    if (!snapshot) {
      return;
    }

    const nextIndex = questions.findIndex((question) => !snapshot.answers[question.id]);

    setSessionId(snapshot.sessionId);
    setAnswers(snapshot.answers);
    setCurrentIndex(nextIndex === -1 ? questions.length - 1 : nextIndex);
    setStarted(true);
    setUnsyncedIds([]);

    trackEvent("quiz_started", {
      track,
      session_id: snapshot.sessionId,
      resumed: true
    });
  };

  const onSelectChoice = (choice: Choice) => {
    if (!activeQuestion || !sessionId || isCompleting || isAdvancingChoice) {
      return;
    }

    const questionId = activeQuestion.id;
    const latencyMs = Date.now() - questionShownAt.current;

    const nextAnswers: Record<string, Choice> = {
      ...answers,
      [questionId]: choice
    };

    setAnswers(nextAnswers);
    updateLocalAnswer(sessionId, questionId, choice);
    addUnsynced(questionId);

    trackEvent("question_answered", {
      track,
      question_id: questionId,
      latency_ms: latencyMs
    });

    void (async () => {
      try {
        await syncSingleAnswer(sessionId, questionId, choice);
        clearUnsynced(questionId);
        setError(null);
      } catch (syncError) {
        const detail =
          syncError instanceof Error ? ` ${syncError.message}` : " Retry sync before completing.";
        setError(`We saved your progress locally, but syncing failed.${detail}`);
      }
    })();

    const nextIndex = questions.findIndex((question) => !nextAnswers[question.id]);
    setIsAdvancingChoice(true);

    void (async () => {
      await new Promise((resolve) => {
        window.setTimeout(resolve, SELECTION_CONFIRM_MS);
      });

      if (nextIndex === -1) {
        await completeQuiz(sessionId, nextAnswers);
        return;
      }

      setCurrentIndex(nextIndex);
    })().finally(() => {
      setIsAdvancingChoice(false);
    });
  };
  onSelectChoiceRef.current = onSelectChoice;

  useEffect(() => {
    if (!started || !activeQuestion || isCompleting || isAdvancingChoice) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) {
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || target?.isContentEditable) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === "a" || key === "b") {
        event.preventDefault();
        onSelectChoiceRef.current(key.toUpperCase() as Choice);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [started, activeQuestion, isCompleting, isAdvancingChoice]);

  const retrySync = async () => {
    if (!sessionId) {
      return;
    }

    setError(null);

    try {
      await syncAllAnswers(sessionId, answers);

      if (Object.keys(answers).length === questions.length) {
        await completeQuiz(sessionId, answers);
      }
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : "";
      const shouldRecoverSession = message.includes("Session not found.") || message.includes("Session is not in progress.");

      if (shouldRecoverSession) {
        try {
          const recovered = await requestNewSession(sessionId);
          saveLocalSession({
            sessionId: recovered.sessionId,
            track,
            answers,
            startedAt: recovered.startedAt,
            completedAt: null
          });
          setSessionId(recovered.sessionId);

          await syncAllAnswers(recovered.sessionId, answers);

          if (Object.keys(answers).length === questions.length) {
            await completeQuiz(recovered.sessionId, answers);
          } else {
            setError(null);
          }
          return;
        } catch (recoveryError) {
          setError(
            recoveryError instanceof Error
              ? recoveryError.message
              : "Could not recover your session. Start a fresh assessment."
          );
          return;
        }
      }

      setError(syncError instanceof Error ? syncError.message : "Could not sync answers.");
    }
  };

  const goToPreviousQuestion = () => {
    if (isAdvancingChoice || isCompleting) {
      return;
    }

    setCurrentIndex((previous) => Math.max(0, previous - 1));
  };

  if (!validTrack) {
    return (
      <PageTransition>
        <section className="surface-card mx-auto mt-24 max-w-xl p-8 text-center">
          <h1 className="text-3xl tracking-tight sm:text-4xl">Track not found</h1>
          <p className="mt-3 text-sm text-textSecondary sm:text-base">
            Please choose either B2B SaaS PM or B2C Consumer PM from the track gate.
          </p>
          <Link href="/" className="primary-button mt-6 inline-flex w-full items-center justify-center sm:w-auto">
            Back to track selection
          </Link>
        </section>
      </PageTransition>
    );
  }

  if (initializing) {
    return (
      <PageTransition>
        <section className="surface-card mx-auto mt-24 max-w-2xl p-8 text-center text-textSecondary">Loading track…</section>
      </PageTransition>
    );
  }

  if (blockedByGate) {
    return (
      <PageTransition>
        <section className="surface-card mx-auto mt-20 max-w-xl p-8 text-center">
          <h1 className="text-3xl tracking-tight sm:text-4xl">Track selection required</h1>
          <p className="mt-3 text-sm text-textSecondary sm:text-base">
            Select your track from the landing page before opening the quiz.
          </p>
          <Link href="/" className="primary-button mt-6 inline-flex items-center justify-center">
            Choose track
          </Link>
        </section>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <section className="mx-auto grid max-w-4xl gap-6 pb-12 pt-4">
        <header className="surface-card p-5 sm:p-7">
          <p className="metric-label">Assessment Track</p>
          <h1 className="mt-2 text-3xl tracking-tight text-textPrimary sm:text-4xl">PM Persona Assessment</h1>
        </header>

        {!started ? (
          <section className="surface-card grid gap-6 p-6 sm:p-7">
            <div>
              <p className="metric-label">Track assumptions</p>
              <ul className="mt-3 space-y-2.5 text-sm text-textSecondary sm:text-base">
                {content.assumptions.map((assumption) => (
                  <li key={assumption} className="flex gap-2.5">
                    <span aria-hidden className="mt-[0.52rem] h-1.5 w-1.5 rounded-full bg-primary" />
                    <span>{assumption}</span>
                  </li>
                ))}
              </ul>
            </div>

            {mode === "resume" && snapshot ? (
              <div className="status-note" data-tone="info">
                Resume available: {Object.keys(snapshot.answers).length}/{questions.length} answered.
              </div>
            ) : null}

            {mode === "completed" && snapshot ? (
              <div className="status-note" data-tone="success">
                Last session was completed. You can view it or retake with a fresh session.
              </div>
            ) : null}

            {error ? <div className="status-note" data-tone="warning">{error}</div> : null}

            <div className="grid gap-3 sm:grid-cols-2">
              {mode === "resume" && snapshot ? (
                <>
                  <button type="button" onClick={resumeSession} className="primary-button" disabled={isStarting}>
                    Resume assessment
                  </button>
                  <button type="button" onClick={startNewSession} className="secondary-button" disabled={isStarting}>
                    Start fresh
                  </button>
                </>
              ) : mode === "completed" && snapshot ? (
                <>
                  <Link href={`/result/${snapshot.sessionId}`} className="secondary-button inline-flex items-center justify-center">
                    View previous result
                  </Link>
                  <button type="button" onClick={startNewSession} className="primary-button" disabled={isStarting}>
                    Retake assessment
                  </button>
                </>
              ) : (
                <button type="button" onClick={startNewSession} className="primary-button sm:col-span-2" disabled={isStarting}>
                  {isStarting ? "Starting…" : "Start Assessment"}
                </button>
              )}
            </div>
          </section>
        ) : (
          <>
            <section className="surface-card p-5 sm:p-6">
              <div className="flex items-center justify-between text-sm text-textSecondary">
                <span className="metric-label">Progress</span>
                <span className="tabular-nums font-medium text-textPrimary">
                  {Math.min(currentIndex + 1, questions.length)}/{questions.length}
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-textSecondary sm:text-sm">
                <span>{Object.keys(answers).length} answered</span>
              </div>
            </section>

            {error ? (
              <section className="surface-card p-4">
                <p className="status-note" data-tone="warning">{error}</p>
                <button type="button" className="secondary-button mt-3" onClick={retrySync}>
                  Retry sync
                </button>
              </section>
            ) : null}

            <AnimatePresence mode="wait">
              {activeQuestion ? (
                <motion.section
                  key={activeQuestion.id}
                  className="surface-card p-6 sm:p-7"
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10, scale: 0.99 }}
                  transition={{ duration: reducedMotion ? 0.14 : 0.38, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <p className="metric-label">Question {Math.min(currentIndex + 1, questions.length)}</p>
                  <p className="mt-4 text-lg font-medium leading-relaxed text-textPrimary sm:text-[1.35rem]">{activeQuestion.prompt}</p>

                  <div className="mt-6 grid gap-3.5">
                    {(Object.keys(activeQuestion.options) as Choice[]).map((choice) => {
                      const option = activeQuestion.options[choice];
                      const selected = currentChoice === choice;

                      return (
                        <motion.button
                          key={`${activeQuestion.id}-${choice}`}
                          type="button"
                          onClick={() => onSelectChoice(choice)}
                          className="option-card"
                          data-selected={selected}
                          aria-pressed={selected}
                          aria-label={`Question ${Math.min(currentIndex + 1, questions.length)} option ${choice}: ${option.label}`}
                          whileHover={reducedMotion ? undefined : { y: -2 }}
                          whileTap={reducedMotion ? undefined : { scale: 0.995 }}
                          animate={selected && !reducedMotion ? { scale: [1, 1.01, 1] } : undefined}
                          transition={{ duration: 0.22, ease: [0.24, 0.8, 0.24, 1] }}
                          disabled={isCompleting || isAdvancingChoice}
                        >
                          <span className="flex items-start gap-3">
                            <span aria-hidden className="shortcut-key">
                              {choice}
                            </span>
                            <span className="option-label block pt-0.5 text-sm text-textPrimary sm:text-base">{option.label}</span>
                          </span>
                        </motion.button>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex items-center justify-start">
                    <button
                      type="button"
                      className="secondary-button inline-flex items-center justify-center"
                      onClick={goToPreviousQuestion}
                      disabled={currentIndex === 0 || isCompleting || isAdvancingChoice}
                      aria-label="Go to previous question"
                    >
                      Previous
                    </button>
                  </div>
                </motion.section>
              ) : null}
            </AnimatePresence>

            {isCompleting ? (
              <section className="surface-card p-4 text-sm text-textSecondary">Calculating your persona result…</section>
            ) : null}
          </>
        )}
      </section>
    </PageTransition>
  );
}
