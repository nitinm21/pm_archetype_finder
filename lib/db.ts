import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { AppDatabase } from "@/lib/types";

const FILE_DB_PATH = path.join(process.cwd(), "data", "pm-persona-db.json");
const KV_REST_API_URL = process.env.KV_REST_API_URL?.replace(/\/$/, "");
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
const KV_DB_KEY = process.env.PM_DB_KEY || "pm-persona-db:v1";
const KV_LOCK_KEY = `${KV_DB_KEY}:lock`;
const KV_LOCK_TTL_MS = 15_000;
const KV_LOCK_WAIT_MS = 8_000;
const KV_LOCK_RETRY_MS = 100;
const RELEASE_LOCK_SCRIPT =
  'if redis.call("GET", KEYS[1]) == ARGV[1] then return redis.call("DEL", KEYS[1]) else return 0 end';
const IS_VERCEL = process.env.VERCEL === "1";
const USE_KV_BACKEND = Boolean(KV_REST_API_URL && KV_REST_API_TOKEN);

const EMPTY_DB: AppDatabase = {
  sessions: {},
  answers: {},
  results: {},
  shares: {}
};

let fileMutationQueue: Promise<void> = Promise.resolve();

function newEmptyDb(): AppDatabase {
  return {
    sessions: {},
    answers: {},
    results: {},
    shares: {}
  };
}

function normalizeDb(value: Partial<AppDatabase> | null | undefined): AppDatabase {
  if (!value || typeof value !== "object") {
    return newEmptyDb();
  }

  return {
    sessions: value.sessions ?? {},
    answers: value.answers ?? {},
    results: value.results ?? {},
    shares: value.shares ?? {}
  };
}

function assertStorageConfigured() {
  if (!IS_VERCEL || USE_KV_BACKEND) {
    return;
  }

  throw new Error("Vercel KV is not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.");
}

async function ensureFileDb() {
  try {
    await fs.access(FILE_DB_PATH);
  } catch {
    await fs.mkdir(path.dirname(FILE_DB_PATH), { recursive: true });
    await fs.writeFile(FILE_DB_PATH, JSON.stringify(EMPTY_DB, null, 2), "utf8");
  }
}

async function readFileDb(): Promise<AppDatabase> {
  await ensureFileDb();
  const raw = await fs.readFile(FILE_DB_PATH, "utf8");
  const parsed = JSON.parse(raw) as Partial<AppDatabase>;
  return normalizeDb(parsed);
}

async function writeFileDb(db: AppDatabase) {
  await fs.writeFile(FILE_DB_PATH, JSON.stringify(db, null, 2), "utf8");
}

type KvArg = string | number;

interface KvResponse<T> {
  result: T;
  error?: string;
}

async function runKvCommand<T>(command: KvArg[]): Promise<T> {
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    throw new Error("Vercel KV credentials are missing.");
  }

  const response = await fetch(KV_REST_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_REST_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify(command)
  });

  let payload: KvResponse<T> | null = null;

  try {
    payload = (await response.json()) as KvResponse<T>;
  } catch {
    if (!response.ok) {
      throw new Error(`KV request failed with status ${response.status}.`);
    }

    throw new Error("KV response was not valid JSON.");
  }

  if (!response.ok) {
    throw new Error(payload.error ?? `KV request failed with status ${response.status}.`);
  }

  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload.result;
}

async function readKvDb(): Promise<AppDatabase> {
  const raw = await runKvCommand<string | null>(["GET", KV_DB_KEY]);
  if (!raw) {
    return newEmptyDb();
  }

  const parsed = JSON.parse(raw) as Partial<AppDatabase>;
  return normalizeDb(parsed);
}

async function writeKvDb(db: AppDatabase) {
  await runKvCommand(["SET", KV_DB_KEY, JSON.stringify(db)]);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function acquireKvLock(): Promise<string> {
  const owner = randomUUID();
  const deadline = Date.now() + KV_LOCK_WAIT_MS;

  while (Date.now() < deadline) {
    const acquired = await runKvCommand<string | null>(["SET", KV_LOCK_KEY, owner, "NX", "PX", KV_LOCK_TTL_MS]);

    if (acquired === "OK") {
      return owner;
    }

    await sleep(KV_LOCK_RETRY_MS + Math.floor(Math.random() * 40));
  }

  throw new Error("Timed out waiting for database lock.");
}

async function releaseKvLock(owner: string) {
  try {
    await runKvCommand<number>(["EVAL", RELEASE_LOCK_SCRIPT, 1, KV_LOCK_KEY, owner]);
    return;
  } catch {
    // Some Redis tiers disable EVAL; continue with a non-atomic fallback.
  }

  try {
    const currentOwner = await runKvCommand<string | null>(["GET", KV_LOCK_KEY]);
    if (currentOwner === owner) {
      await runKvCommand<number>(["DEL", KV_LOCK_KEY]);
    }
  } catch {
    // Best-effort unlock.
  }
}

async function withFileDbMutation<T>(mutate: (db: AppDatabase) => Promise<T> | T): Promise<T> {
  const run = fileMutationQueue.catch(() => undefined).then(async () => {
    const db = await readFileDb();
    const result = await mutate(db);
    await writeFileDb(db);
    return result;
  });

  fileMutationQueue = run.then(
    () => undefined,
    () => undefined
  );

  return run;
}

async function withKvDbMutation<T>(mutate: (db: AppDatabase) => Promise<T> | T): Promise<T> {
  const owner = await acquireKvLock();

  try {
    const db = await readKvDb();
    const result = await mutate(db);
    await writeKvDb(db);
    return result;
  } finally {
    await releaseKvLock(owner);
  }
}

export async function readDb(): Promise<AppDatabase> {
  if (USE_KV_BACKEND) {
    return readKvDb();
  }

  assertStorageConfigured();
  return readFileDb();
}

export async function withDbMutation<T>(mutate: (db: AppDatabase) => Promise<T> | T): Promise<T> {
  if (USE_KV_BACKEND) {
    return withKvDbMutation(mutate);
  }

  assertStorageConfigured();
  return withFileDbMutation(mutate);
}
