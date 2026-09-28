import type {
  AgentRecommendation,
  Memory,
  MemoryProviderStatus,
  RFPAnalysis,
  RecalledMemory,
} from "@/types";
import { memories } from "@/services/proposals/store.server";

/**
 * Hindsight long-term memory abstraction.
 *
 * The three operations the product is designed around:
 *   retainMemory()    — store a proposal experience
 *   recallMemories()  — retrieve experiences relevant to a new RFP
 *   reflectOnMemories() — reason over experiences to produce a recommendation
 *
 * Hindsight is NOT connected in this build. When HINDSIGHT_API_KEY and
 * HINDSIGHT_BASE_URL are absent, every call falls back to a transparent local
 * heuristic over the workspace's own proposal history and reports
 * `mode: "local-heuristic"`. Nothing here is presented to the user as
 * Hindsight memory. Implement the `live` branches after export.
 */

interface HindsightConfig {
  apiKey: string;
  baseUrl: string;
}

function getConfig(): HindsightConfig | null {
  const apiKey = process.env["HINDSIGHT_API_KEY"];
  const baseUrl = process.env["HINDSIGHT_BASE_URL"];
  if (!apiKey || !baseUrl) return null;
  return { apiKey, baseUrl };
}

export function getMemoryStatus(): MemoryProviderStatus {
  const config = getConfig();
  return config
    ? {
        provider: "hindsight",
        connected: true,
        mode: "live",
        message: "Connected to Hindsight long-term memory.",
      }
    : {
        provider: "hindsight",
        connected: false,
        mode: "local-heuristic",
        message:
          "Hindsight is not connected. Recall and reflection run on a local heuristic over this workspace's proposal history.",
      };
}

const STOP_WORDS = new Set([
  "the","and","for","with","that","this","from","will","must","have","our","are","you","your",
  "their","should","proposal","rfp","request","provide","including","such","been","into","each",
]);

function keywords(text: string): string[] {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w)),
    ),
  );
}

export interface RecallQuery {
  industry?: string;
  clientName?: string;
  text: string;
  limit?: number;
}

export async function recallMemories(query: RecallQuery): Promise<RecalledMemory[]> {
  const config = getConfig();
  if (config) {
    // TODO(hindsight): POST `${config.baseUrl}/recall` with the query and map
    // the response onto RecalledMemory[].
    throw new Error("Hindsight live recall is not implemented yet.");
  }
  return localRecall(query);
}

function localRecall(query: RecallQuery): RecalledMemory[] {
  const terms = keywords(query.text);
  const scored = memories.map((memory) => {
    const reasons: string[] = [];
    let score = 0;

    if (query.industry && memory.industry === query.industry) {
      score += 0.45;
      reasons.push(`Same industry (${memory.industry})`);
    }
    if (query.clientName && memory.title.toLowerCase().includes(query.clientName.toLowerCase())) {
      score += 0.2;
      reasons.push("Same client");
    }

    const haystack = `${memory.content} ${memory.lessons.join(" ")} ${memory.successfulPatterns.join(" ")} ${memory.failedPatterns.join(" ")}`.toLowerCase();
    const overlap = terms.filter((t) => haystack.includes(t));
    if (overlap.length) {
      score += Math.min(0.35, overlap.length * 0.05);
      reasons.push(`Shared themes: ${overlap.slice(0, 4).join(", ")}`);
    }
    if (memory.outcome === "won") reasons.push("Successful experience to repeat");
    if (memory.outcome === "lost") reasons.push("Unsuccessful experience to avoid");

    return { ...memory, relevance: Math.min(0.98, score), relevanceReasons: reasons };
  });

  return scored
    .filter((m) => m.relevance > 0.1)
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, query.limit ?? 5);
}

export async function retainMemory(memory: Memory): Promise<Memory> {
  const config = getConfig();
  if (config) {
    // TODO(hindsight): POST `${config.baseUrl}/retain` with the experience.
    throw new Error("Hindsight live retain is not implemented yet.");
  }
  memories.unshift(memory);
  return memory;
}

export async function reflectOnMemories(
  analysis: RFPAnalysis,
  recalled: RecalledMemory[],
): Promise<AgentRecommendation> {
  const config = getConfig();
  if (config) {
    // TODO(hindsight): POST `${config.baseUrl}/reflect` and return the
    // provider's reasoning instead of the local aggregation below.
    throw new Error("Hindsight live reflection is not implemented yet.");
  }

  const wins = recalled.filter((m) => m.outcome === "won");
  const losses = recalled.filter((m) => m.outcome === "lost");

  const successfulPatterns = rank(wins.flatMap((m) => m.successfulPatterns));
  const warnings = losses.flatMap((m) => m.lessons);

  const emphasis = successfulPatterns.slice(0, 4);
  const strategy = emphasis.length
    ? `Based on previous experience, this proposal emphasizes ${emphasis
        .map((p) => p.toLowerCase())
        .join(", ")}${losses.length ? ", and avoids the generic language that cost earlier bids" : ""}.`
    : `No comparable experience yet. This proposal follows the standard ${analysis.industry} structure.`;

  return {
    summary: `${recalled.length} relevant previous experience${recalled.length === 1 ? "" : "s"} found.`,
    strategy,
    successfulPatterns: emphasis,
    warnings: warnings.slice(0, 4),
    basedOn: recalled,
  };
}

function rank(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([v]) => v);
}
