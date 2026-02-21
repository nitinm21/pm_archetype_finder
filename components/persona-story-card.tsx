import { useMemo } from "react";

interface PersonaStoryCardProps {
  personaName: string;
  summary: string;
  strengths: string[];
  trackLabel: string;
  compact?: boolean;
}

interface StoryTheme {
  aura: string;
  accent: string;
  secondary: string;
}

const STORY_THEMES: StoryTheme[] = [
  {
    aura: "linear-gradient(145deg, rgba(96, 151, 255, 0.45), rgba(92, 130, 230, 0.12) 60%, rgba(255, 158, 102, 0.2))",
    accent: "#8dc1ff",
    secondary: "#ffb384"
  },
  {
    aura: "linear-gradient(145deg, rgba(131, 181, 255, 0.46), rgba(80, 143, 216, 0.14) 55%, rgba(123, 210, 179, 0.22))",
    accent: "#9fd3ff",
    secondary: "#7fdab8"
  },
  {
    aura: "linear-gradient(145deg, rgba(142, 167, 255, 0.45), rgba(103, 113, 220, 0.13) 55%, rgba(239, 165, 113, 0.22))",
    accent: "#b5c2ff",
    secondary: "#ffc197"
  }
];

function hashLabel(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
}

function pickPersonaGlyph(name: string) {
  const normalized = name.toLowerCase();

  if (normalized.includes("architect") || normalized.includes("orchestrator")) {
    return "🏛";
  }

  if (normalized.includes("captain") || normalized.includes("conductor") || normalized.includes("operator")) {
    return "🧭";
  }

  if (normalized.includes("experimenter") || normalized.includes("researcher")) {
    return "🧪";
  }

  if (normalized.includes("driver") || normalized.includes("pioneer")) {
    return "⚡";
  }

  if (normalized.includes("coach") || normalized.includes("advocate")) {
    return "🤝";
  }

  if (normalized.includes("visionary")) {
    return "🔭";
  }

  return "✦";
}

export function PersonaStoryCard({ personaName, summary, strengths, trackLabel, compact = false }: PersonaStoryCardProps) {
  const theme = useMemo(() => STORY_THEMES[hashLabel(personaName) % STORY_THEMES.length], [personaName]);
  const glyph = useMemo(() => pickPersonaGlyph(personaName), [personaName]);

  return (
    <article className={`story-share-card ${compact ? "story-share-card-compact" : ""}`}>
      <div className="story-share-card-aura" style={{ background: theme.aura }} />
      <header className="story-share-card-head">
        <span className="story-share-card-mark">PM Persona Result</span>
        <span className="story-share-card-glyph" aria-hidden>
          {glyph}
        </span>
      </header>

      <div className="story-share-card-body">
        <p className="story-share-card-track">{trackLabel}</p>
        <h3 className="story-share-card-title">{personaName}</h3>
        <p className="story-share-card-summary">{summary}</p>

        <ul className="story-share-card-points">
          {strengths.slice(0, compact ? 2 : 3).map((strength) => (
            <li key={strength}>{strength}</li>
          ))}
        </ul>
      </div>

      <footer className="story-share-card-foot">
        <span style={{ color: theme.accent }}>pm persona studio</span>
        <span style={{ color: theme.secondary }}>share-ready result</span>
      </footer>
    </article>
  );
}
