import { promises as fs } from "node:fs";
import path from "node:path";
import type { AppDatabase } from "@/lib/types";

const DB_PATH = path.join(process.cwd(), "data", "pm-persona-db.json");

const EMPTY_DB: AppDatabase = {
  sessions: {},
  answers: {},
  results: {},
  shares: {}
};

let mutationQueue: Promise<void> = Promise.resolve();

async function ensureDbFile() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await fs.writeFile(DB_PATH, JSON.stringify(EMPTY_DB, null, 2), "utf8");
  }
}

export async function readDb(): Promise<AppDatabase> {
  await ensureDbFile();
  const raw = await fs.readFile(DB_PATH, "utf8");
  const parsed = JSON.parse(raw) as AppDatabase;
  return {
    sessions: parsed.sessions ?? {},
    answers: parsed.answers ?? {},
    results: parsed.results ?? {},
    shares: parsed.shares ?? {}
  };
}

async function writeDb(db: AppDatabase) {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

export async function withDbMutation<T>(mutate: (db: AppDatabase) => Promise<T> | T): Promise<T> {
  const run = mutationQueue.catch(() => undefined).then(async () => {
    const db = await readDb();
    const result = await mutate(db);
    await writeDb(db);
    return result;
  });

  mutationQueue = run.then(
    () => undefined,
    () => undefined
  );

  return run;
}
