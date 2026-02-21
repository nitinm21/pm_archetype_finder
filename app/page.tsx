"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useRouter } from "next/navigation";
import { PageTransition } from "@/components/page-transition";
import { trackEvent } from "@/lib/analytics-client";
import { getStoredSelectedTrack, setStoredSelectedTrack } from "@/lib/session-client";
import type { TrackId } from "@/lib/types";

const TRACKS: Array<{
  id: TrackId;
  title: string;
  subtitle: string;
  accent: string;
}> = [
  {
    id: "b2b",
    title: "B2B SaaS PM",
    subtitle: "Enterprise complexity, multi-stakeholder tradeoffs",
    accent: "from-[#2f5fce45] to-[#2f5fce0d]"
  },
  {
    id: "b2c",
    title: "B2C Consumer PM",
    subtitle: "Retention pressure, trust, and growth velocity",
    accent: "from-[#be6a2f4d] to-[#be6a2f0d]"
  }
];

export default function HomePage() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [selectedTrack, setSelectedTrack] = useState<TrackId | null>(null);

  useEffect(() => {
    const remembered = getStoredSelectedTrack();
    setSelectedTrack(remembered);
    trackEvent("landing_viewed");
  }, []);

  const transitions = useMemo(
    () => ({
      initial: reducedMotion ? { opacity: 0 } : { opacity: 0, y: 12 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: reducedMotion ? 0.12 : 0.38, ease: [0.2, 0.8, 0.2, 1] }
    }),
    [reducedMotion]
  );

  const chooseTrack = (track: TrackId) => {
    setStoredSelectedTrack(track);
    setSelectedTrack(track);
    trackEvent("track_selected", { track });

    router.push(`/quiz/${track}`);
  };

  return (
    <PageTransition>
      <motion.section
        className="mx-auto grid max-w-6xl gap-8 pb-12 pt-4"
        initial={transitions.initial}
        animate={transitions.animate}
        transition={transitions.transition}
      >
        <header className="space-y-6">
          <h1 className="display-heading max-w-4xl text-[3rem] text-textPrimary sm:text-[4.5rem] lg:text-[5.9rem]">
            Product Manager Persona Finder.
          </h1>
          <p className="max-w-2xl text-base text-textSecondary sm:text-lg">
            A short, scenario-based assessment that reveals your operating style in product decision-making.
          </p>
        </header>

        <div className="grid gap-5 md:grid-cols-2">
          {TRACKS.map((track, index) => {
            const isSelected = selectedTrack === track.id;

            return (
              <motion.article
                key={track.id}
                className="surface-card relative overflow-hidden p-6 sm:p-7"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{
                  duration: reducedMotion ? 0.14 : 0.38,
                  delay: reducedMotion ? 0 : index * 0.08,
                  ease: [0.2, 0.8, 0.2, 1]
                }}
              >
                <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${track.accent} opacity-80`} />
                <div className="relative flex h-full flex-col gap-4">
                  <p className="metric-label">Track {index + 1}</p>
                  <h2 className="text-2xl tracking-tight text-textPrimary sm:text-[2.05rem]">{track.title}</h2>
                  <p className="max-w-md text-sm text-textSecondary sm:text-base">{track.subtitle}</p>

                  <button
                    type="button"
                    onClick={() => chooseTrack(track.id)}
                    className="primary-button mt-3 w-full"
                    aria-label={`Choose ${track.title} track`}
                  >
                    {isSelected ? "Continue with this track" : "Choose this track"}
                  </button>
                </div>
              </motion.article>
            );
          })}
        </div>
      </motion.section>
    </PageTransition>
  );
}
