"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { PageTransition } from "@/components/page-transition";
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

type ShareState = "idle" | "creating" | "copied";

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
      return "Share Link Copied";
    }

    return "Copy Public Share Link";
  }, [shareState]);

  const shareStatusMessage = useMemo(() => {
    if (shareState === "creating") {
      return "Preparing your public share link…";
    }

    if (shareState === "copied") {
      return "Public share link copied to clipboard.";
    }

    return "";
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
              Back to Home
            </Link>
          </div>
        </section>
      </PageTransition>
    );
  }

  const { session, result } = data;
  const trackLabel = formatTrackLabel(session.track);
  const persona = result.computed.persona;

  return (
    <PageTransition>
      <motion.section
        className="mx-auto grid w-full max-w-6xl gap-6 pb-12 pt-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0.14 : 0.42, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <header className="space-y-2 lg:col-span-2">
          <p className="metric-label">Persona Result</p>
        </header>

        <section className="story-shell share-story-shell result-story-shell w-full p-5 sm:p-6">
          <div className="share-story-lights" aria-hidden>
            <span className="share-story-orb share-story-orb-one" />
            <span className="share-story-orb share-story-orb-two" />
            <span className="share-story-orb share-story-orb-three" />
          </div>

          <div className="share-story-particles" aria-hidden>
            {Array.from({ length: 12 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>

          <div className="relative z-10">
            <div className="share-story-content max-w-4xl">
              <p className="story-kicker">PM Persona</p>
              <p className="story-plain-track mt-4">{trackLabel}</p>

              <h1 className="story-title share-story-title">{persona.name}</h1>
              <p className="story-copy">{persona.summary}</p>

              <h2 className="story-kicker mt-7">Core Strengths</h2>
              <ul className="story-strength-list">
                {persona.strengths.map((strength) => (
                  <li key={strength} className="story-strength-item">
                    {strength}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <aside className="grid w-full gap-4 lg:sticky lg:top-6 lg:self-start">
          <section className="surface-card share-cta-card result-share-card w-full p-5 sm:p-6" aria-labelledby="share-result-title">
            <h2 id="share-result-title" className="share-cta-title text-textPrimary">
              Share Your Persona Result
            </h2>
            <p className="share-cta-copy result-share-copy text-textSecondary">
              Copy your public link and share it in Slack, LinkedIn, X, or anywhere your team collaborates.
            </p>

            <div className="share-cta-actions result-share-actions">
              <button type="button" className="primary-button share-cta-button inline-flex items-center justify-center" onClick={onCopyShareLink} disabled={shareState === "creating"}>
                {shareStateLabel}
              </button>
              <Link href="/" className="secondary-button inline-flex items-center justify-center">
                Go Home
              </Link>
            </div>

            <p className="result-share-status text-xs text-textSecondary" aria-live="polite">
              {shareStatusMessage}
            </p>
            {shareUrl ? <p className="result-share-link break-all text-xs text-textSecondary">{shareUrl}</p> : null}
            {error ? <p className="status-note" data-tone="warning">{error}</p> : null}
          </section>
        </aside>
      </motion.section>
    </PageTransition>
  );
}
