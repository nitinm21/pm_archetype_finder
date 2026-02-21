"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { PageTransition } from "@/components/page-transition";
import { PersonaStoryCard } from "@/components/persona-story-card";
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
        className="mx-auto grid max-w-6xl gap-6 pb-12 pt-4"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0.14 : 0.42, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <section className="story-shell p-5 sm:p-7">
          <div className="relative z-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <p className="story-kicker">Shared PM Persona Story</p>
              <p className="story-plain-track mt-4">{trackLabel}</p>
              <h1 className="story-title">{persona.name}</h1>
              <p className="story-copy">{persona.summary}</p>

              <p className="story-kicker mt-6">Core Strengths</p>
              <ul className="story-strength-list">
                {persona.strengths.map((strength) => (
                  <li key={strength} className="story-strength-item">
                    {strength}
                  </li>
                ))}
              </ul>

              <p className="mt-5 text-sm text-[#d3e0ff]">Opened {data.share.views.toLocaleString()} times</p>
            </div>

            <PersonaStoryCard
              personaName={persona.name}
              summary={persona.summary}
              strengths={persona.strengths}
              trackLabel={trackLabel}
            />
          </div>
        </section>

        <section className="surface-card p-5 sm:p-6">
          <div className="flex flex-wrap gap-3">
            <Link href="/" className="primary-button inline-flex items-center justify-center">
              Take the assessment
            </Link>
          </div>
        </section>
      </motion.section>
    </PageTransition>
  );
}
