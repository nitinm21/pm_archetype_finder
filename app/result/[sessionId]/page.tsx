"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PageTransition } from "@/components/page-transition";
import { PersonaStoryCard } from "@/components/persona-story-card";
import { trackEvent } from "@/lib/analytics-client";
import { formatTrackLabel } from "@/lib/format";
import { setStoredSelectedTrack } from "@/lib/session-client";
import type { ResultRecord, SessionRecord } from "@/lib/types";

interface ResultPageProps {
  params: {
    sessionId: string;
  };
}

interface ResultResponse {
  session: SessionRecord;
  result: ResultRecord;
}

type ShareState = "idle" | "creating" | "copied" | "shared";

const STORY_STEPS = 3;

async function copyToClipboard(value: string) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
  }
}

export default function ResultPage({ params }: ResultPageProps) {
  const router = useRouter();
  const reducedMotion = useReducedMotion();

  const [data, setData] = useState<ResultResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareState, setShareState] = useState<ShareState>("idle");
  const [storyStep, setStoryStep] = useState(0);

  useEffect(() => {
    const run = async () => {
      try {
        const response = await fetch(`/api/result/${params.sessionId}`, { cache: "no-store" });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Could not load result.");
        }

        const payload = (await response.json()) as ResultResponse;
        setData(payload);
        setStoredSelectedTrack(payload.session.track);

        trackEvent("result_viewed", {
          track: payload.session.track,
          session_id: payload.session.id,
          persona: payload.result.computed.persona.name
        });
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load result.");
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [params.sessionId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      if (event.key === "ArrowRight") {
        event.preventDefault();
        setStoryStep((current) => Math.min(current + 1, STORY_STEPS - 1));
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setStoryStep((current) => Math.max(current - 1, 0));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const ensureShareUrl = async () => {
    if (!data) {
      throw new Error("Result is not loaded.");
    }

    if (shareUrl) {
      return shareUrl;
    }

    const response = await fetch(`/api/share/${data.session.id}`, {
      method: "POST"
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? "Could not create share link.");
    }

    const payload = (await response.json()) as { url: string };
    const freshUrl = `${window.location.origin}${payload.url}`;
    setShareUrl(freshUrl);

    return freshUrl;
  };

  const onCopyShareLink = async () => {
    if (!data) {
      return;
    }

    setShareState("creating");
    setError(null);

    try {
      const url = await ensureShareUrl();
      await copyToClipboard(url);
      setShareState("copied");

      trackEvent("result_shared", {
        track: data.session.track,
        session_id: data.session.id,
        persona: data.result.computed.persona.name,
        method: "copy_link"
      });
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "Could not create share link.");
      setShareState("idle");
    }
  };

  const shareStateLabel = useMemo(() => {
    if (shareState === "creating") {
      return "Preparing share link…";
    }

    if (shareState === "copied") {
      return "Share link copied";
    }

    if (shareState === "shared") {
      return "Shared";
    }

    return "Copy public share link";
  }, [shareState]);

  if (loading) {
    return (
      <PageTransition>
        <section className="surface-card mx-auto mt-24 max-w-2xl p-8 text-center text-textSecondary">Loading result…</section>
      </PageTransition>
    );
  }

  if (!data) {
    return (
      <PageTransition>
        <section className="surface-card mx-auto mt-20 max-w-2xl p-8 text-center">
          <h1 className="text-3xl tracking-tight sm:text-4xl">Result unavailable</h1>
          <p className="mt-3 text-sm text-textSecondary sm:text-base">{error ?? "We could not find this result session."}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" className="secondary-button" onClick={() => router.refresh()}>
              Retry
            </button>
            <Link href="/" className="primary-button inline-flex items-center justify-center">
              Back to home
            </Link>
          </div>
        </section>
      </PageTransition>
    );
  }

  const { session, result } = data;
  const trackLabel = formatTrackLabel(session.track);
  const persona = result.computed.persona;

  const goPrevious = () => {
    setStoryStep((current) => Math.max(current - 1, 0));
  };

  const goNext = () => {
    setStoryStep((current) => Math.min(current + 1, STORY_STEPS - 1));
  };

  const onStoryStageClick = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;

    if (target.closest("button, a")) {
      return;
    }

    const bounds = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - bounds.left;

    if (x < bounds.width * 0.35) {
      goPrevious();
      return;
    }

    goNext();
  };

  return (
    <PageTransition>
      <motion.section
        className="mx-auto grid max-w-6xl gap-6 pb-12 pt-4"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0.14 : 0.42, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <header className="space-y-2">
          <p className="metric-label">Persona Result</p>
          <p className="text-sm text-textSecondary sm:text-base">Generated from your {trackLabel} responses.</p>
        </header>

        <section className="story-shell p-5 sm:p-7" onClick={onStoryStageClick}>
          <div className="relative z-10">
            <div className="space-y-4">
              <p className="story-kicker">Wrapped Story</p>
              <div className="story-progress" aria-label="Result story progress">
                {Array.from({ length: STORY_STEPS }).map((_, index) => (
                  <span key={index} className="story-progress-segment" data-active={index <= storyStep} />
                ))}
              </div>
              <p className="text-xs text-[#c7d6fb]">Tap left or right to move through the story.</p>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={storyStep}
                className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                transition={{ duration: reducedMotion ? 0.14 : 0.28, ease: [0.2, 0.8, 0.2, 1] }}
              >
                <div>
                  {storyStep === 0 ? (
                    <>
                      <p className="story-plain-track">{trackLabel}</p>
                      <h1 className="story-title">{persona.name}</h1>
                      <p className="story-copy">{persona.summary}</p>
                    </>
                  ) : null}

                  {storyStep === 1 ? (
                    <>
                      <p className="story-kicker">How You Show Up</p>
                      <h2 className="story-title">Core Strengths</h2>
                      <p className="story-copy">These patterns came through most clearly in your responses.</p>
                      <ul className="story-strength-list">
                        {persona.strengths.map((strength) => (
                          <li key={strength} className="story-strength-item">
                            {strength}
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}

                  {storyStep === 2 ? (
                    <>
                      <p className="story-kicker">Share It</p>
                      <h2 className="story-title">Send Your PM Story</h2>
                      <p className="story-copy">Copy your link below and drop it in Slack, X, LinkedIn, or anywhere your team hangs out.</p>
                    </>
                  ) : null}
                </div>

                <PersonaStoryCard
                  personaName={persona.name}
                  summary={persona.summary}
                  strengths={persona.strengths}
                  trackLabel={trackLabel}
                  compact={storyStep !== 2}
                />
              </motion.div>
            </AnimatePresence>

          </div>
        </section>

        {error ? <p className="status-note" data-tone="warning">{error}</p> : null}

        <section className="surface-card p-5 sm:p-6">
          <div className="flex flex-wrap gap-3">
            <button type="button" className="primary-button" onClick={onCopyShareLink} disabled={shareState === "creating"}>
              {shareStateLabel}
            </button>
            <Link href="/" className="secondary-button inline-flex items-center justify-center">
              Go Home
            </Link>
          </div>
          {shareUrl ? <p className="mt-4 break-all text-xs text-textSecondary">{shareUrl}</p> : null}
        </section>
      </motion.section>
    </PageTransition>
  );
}
