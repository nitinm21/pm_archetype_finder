"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { PageTransition } from "@/components/page-transition";
import { formatTrackLabel } from "@/lib/format";
import type { ResultRecord, SessionRecord, ShareRecord } from "@/lib/types";

interface SharePageProps {
  params: {
    slug: string;
  };
}

interface ShareResponse {
  share: ShareRecord;
  result: ResultRecord;
  session: SessionRecord;
}

export default function SharePage({ params }: SharePageProps) {
  const reducedMotion = useReducedMotion();

  const [data, setData] = useState<ShareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`/api/share/${params.slug}`, { cache: "no-store" });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Could not load shared result.");
        }

        const payload = (await response.json()) as ShareResponse;
        setData(payload);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Could not load shared result.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [params.slug]);

  if (loading) {
    return (
      <PageTransition>
        <section className="surface-card mx-auto mt-24 max-w-2xl p-8 text-center text-textSecondary">Loading shared result…</section>
      </PageTransition>
    );
  }

  if (!data) {
    return (
      <PageTransition>
        <section className="surface-card mx-auto mt-20 max-w-2xl p-8 text-center">
          <h1 className="text-3xl tracking-tight sm:text-4xl">Share link unavailable</h1>
          <p className="mt-3 text-sm text-textSecondary sm:text-base">{error ?? "This share link does not exist or has expired."}</p>
          <Link href="/" className="primary-button mt-6 inline-flex items-center justify-center">
            Start your own assessment
          </Link>
        </section>
      </PageTransition>
    );
  }

  const trackLabel = formatTrackLabel(data.session.track);
  const persona = data.result.computed.persona;

  return (
    <PageTransition>
      <motion.section
        className="mx-auto grid w-full max-w-6xl justify-items-center gap-6 pb-12 pt-4 lg:grid-cols-[440px_minmax(0,1fr)] lg:items-start lg:justify-items-stretch"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0.14 : 0.42, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <section className="story-shell share-story-shell w-full p-5 sm:p-6 lg:justify-self-start">
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
              <h1 className="max-w-xl text-3xl font-semibold tracking-tight text-[#f2f5ff] sm:text-4xl">
                Here&apos;s my persona
              </h1>
              <p className="story-plain-track mt-4">{trackLabel}</p>

              <h2 className="story-title share-story-title">{persona.name}</h2>
              <p className="story-copy">{persona.summary}</p>

              <p className="story-kicker mt-6">Core Strengths</p>
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

        <section className="surface-card share-cta-card w-full p-5 sm:p-6 lg:max-w-[520px] lg:justify-self-end lg:sticky lg:top-6 lg:self-start">
          <h2 className="share-cta-title text-textPrimary">
            Want to know what kind of Product Manager you are?
          </h2>
          <p className="share-cta-copy text-textSecondary">
            Take the assessment to discover your PM archetype!
          </p>
          <div className="share-cta-actions">
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="primary-button share-cta-button inline-flex items-center justify-center"
            >
              Take the assessment
            </Link>
          </div>
        </section>
      </motion.section>
    </PageTransition>
  );
}
