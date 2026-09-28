import fs from "node:fs";
import path from "node:path";
import type { Client, Memory, Proposal, ProposalOutcome } from "@/types";
import { canonicalPatterns } from "@/lib/outcome-factors";

/**
 * Starts empty: every client, proposal and memory comes from real use of the app
 * (or from scripts/seed-demo.ts, which drives the same API a user would).
 */
export const clients: Client[] = [];

export const proposals: Proposal[] = [];

export const outcomes: ProposalOutcome[] = [];

/**
 * Mirror of experiences successfully retained in Hindsight (for listing and insights).
 * Recall always goes to Hindsight; demo experiences are seeded via scripts/seed-demo.ts.
 */
export const memories: Memory[] = [];

export const workspace = {
  id: "w-demo",
  name: "Demo Workspace",
  company: "Northwind Consulting",
  memoryProvider: "hindsight" as const,
};

export const user = {
  id: "u-1",
  name: "Alex Rivera",
  email: "alex@northwind.co",
  role: "Proposal Lead",
};

// ---------------------------------------------------------------------------
// Persistence
//
// Serverless hosts (Vercel) have no lasting disk and run many instances, so when
// Upstash Redis is configured (Vercel Marketplace sets KV_REST_API_* or
// UPSTASH_REDIS_REST_*), state lives there and is reloaded at the start of every
// API request. Otherwise it is kept in a local JSON file for development.
// ---------------------------------------------------------------------------

type StoreData = {
  clients: Client[];
  proposals: Proposal[];
  outcomes: ProposalOutcome[];
  memories: Memory[];
};

const COLLECTIONS = { clients, proposals, outcomes, memories } as const;
const KEYS = Object.keys(COLLECTIONS) as (keyof StoreData)[];

function redisConfig() {
  const url = process.env["KV_REST_API_URL"] || process.env["UPSTASH_REDIS_REST_URL"];
  const token = process.env["KV_REST_API_TOKEN"] || process.env["UPSTASH_REDIS_REST_TOKEN"];
  if (!url || !token) return null;
  const prefix = process.env["APP_STORE_PREFIX"] || "proposal-intelligence";
  return { url: url.replace(/\/$/, ""), token, key: (name: string) => `${prefix}:${name}` };
}

/** Runs one Redis command through Upstash's REST API. */
async function redis(command: string[]): Promise<unknown> {
  const config = redisConfig()!;
  const res = await fetch(config.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
  if (!res.ok || body.error) {
    throw new Error(`Redis ${command[0]} failed (HTTP ${res.status}): ${body.error ?? ""}`);
  }
  return body.result;
}

function replaceAll(data: Partial<Record<keyof StoreData, unknown>>) {
  for (const key of KEYS) {
    const value = data[key];
    if (!Array.isArray(value)) continue;
    const target = COLLECTIONS[key] as unknown[];
    target.length = 0;
    target.push(...value);
  }
  // Older memories may hold label variants; normalise them on read.
  for (const m of memories) {
    m.successfulPatterns = canonicalPatterns(m.successfulPatterns ?? []);
    m.failedPatterns = canonicalPatterns(m.failedPatterns ?? []);
  }
}

const getStoreFilePath = () =>
  process.env["APP_DATA_PATH"] || path.join(process.cwd(), "data", "store.json");

let fileLoaded = false;

/** Loads the latest state. Call before reading the store in a request. */
export async function loadStore(): Promise<void> {
  const config = redisConfig();
  if (config) {
    const values = (await redis(["MGET", ...KEYS.map(config.key)])) as (string | null)[];
    replaceAll(
      Object.fromEntries(KEYS.map((key, i) => [key, values[i] ? JSON.parse(values[i]!) : []])),
    );
    return;
  }

  // Local file: this process is the only writer, so reading once is enough.
  if (fileLoaded) return;
  fileLoaded = true;
  try {
    const filePath = getStoreFilePath();
    if (fs.existsSync(filePath)) replaceAll(JSON.parse(fs.readFileSync(filePath, "utf-8")));
  } catch (err) {
    console.warn("Could not load store from disk:", err);
  }
}

/** Persists the current state. Call after every mutation. */
export async function saveStore(): Promise<void> {
  const config = redisConfig();
  if (config) {
    await redis([
      "MSET",
      ...KEYS.flatMap((key) => [config.key(key), JSON.stringify(COLLECTIONS[key])]),
    ]);
    return;
  }

  try {
    const filePath = getStoreFilePath();
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(COLLECTIONS, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not save store to disk:", err);
  }
}

export const storeBackend = () => (redisConfig() ? "upstash-redis" : "local-file");
