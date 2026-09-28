import type {
  AgentRecommendation,
  Industry,
  Memory,
  MemoryProviderStatus,
  Outcome,
  RFPAnalysis,
  RecalledMemory,
} from "@/types";
import { memories, saveStore } from "@/services/proposals/store.server";
import { callLLM, getLLMConfig } from "@/services/ai/llm.server";

/**
 * Hindsight long-term memory (https://hindsight.vectorize.io).
 *
 * Hindsight is the source of truth for every past proposal experience:
 *   retainMemory()      — POST /v1/default/banks/{bank}/memories
 *   recallMemories()    — POST /v1/default/banks/{bank}/memories/recall
 *   reflectOnMemories() — POST /v1/default/banks/{bank}/reflect
 *
 * There is no simulated fallback. If Hindsight is not configured or fails, recall and
 * retain throw a HindsightError and the API routes surface that to the UI.
 *
 * The local `memories` array is only a mirror of what this app successfully retained,
 * used for the Memory Bank list and Insights charts. Recall never reads from it.
 */

const DEFAULT_BASE_URL = "https://api.hindsight.vectorize.io";

interface HindsightConfig {
  baseUrl: string;
  bankId: string;
  apiKey?: string;
}

export class HindsightError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "HindsightError";
  }
}

function getConfig(): HindsightConfig | null {
  const apiKey = process.env["HINDSIGHT_API_KEY"];
  const explicitUrl = process.env["HINDSIGHT_BASE_URL"];
  // Hindsight Cloud needs an API key; a self-hosted server may run without one.
  if (!apiKey && !explicitUrl) return null;

  const config: HindsightConfig = {
    baseUrl: (explicitUrl || DEFAULT_BASE_URL).replace(/\/$/, ""),
    bankId: process.env["HINDSIGHT_BANK_ID"] || "proposal-intelligence",
  };
  if (apiKey) config.apiKey = apiKey;
  return config;
}

function requireConfig(): HindsightConfig {
  const config = getConfig();
  if (!config) {
    throw new HindsightError(
      "Hindsight is not configured. Set HINDSIGHT_API_KEY (and optionally HINDSIGHT_BANK_ID) in .env.",
      503,
    );
  }
  return config;
}

async function hindsightFetch<T>(
  config: HindsightConfig,
  path: string,
  init: { method: string; body?: unknown; timeoutMs?: number },
): Promise<T> {
  const url = `${config.baseUrl}/v1/default/banks/${encodeURIComponent(config.bankId)}${path}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method,
      headers,
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
      signal: AbortSignal.timeout(init.timeoutMs ?? 30_000),
    });
  } catch (err) {
    throw new HindsightError(
      `Hindsight unreachable at ${config.baseUrl}: ${(err as Error).message}`,
    );
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new HindsightError(
      `Hindsight ${init.method} ${path || "/"} failed (HTTP ${res.status})${detail ? `: ${detail}` : ""}`,
      res.status,
    );
  }
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Bank setup — tells Hindsight what to extract on retain and how to reason on reflect
// ---------------------------------------------------------------------------

const RETAIN_MISSION =
  "This bank stores outcomes of past business proposals written in response to RFPs. " +
  "Extract the client, industry, RFP requirements, the proposal strategy used, the outcome (won/lost/pending), " +
  "what worked, what failed, client preferences, and concrete lessons for future proposals.";

const REFLECT_MISSION =
  "You are a proposal strategist. Use past proposal outcomes to recommend how a new proposal should be written: " +
  "which approaches to repeat because they won, which pitfalls to avoid because they lost, and why. " +
  "Always cite the specific past proposal each recommendation comes from.";

let bankReady: Promise<void> | null = null;

function ensureBank(config: HindsightConfig): Promise<void> {
  if (!bankReady) {
    bankReady = hindsightFetch(config, "", {
      method: "PUT",
      body: { retain_mission: RETAIN_MISSION, reflect_mission: REFLECT_MISSION },
    })
      .then(() => undefined)
      .catch((err) => {
        // Banks are also created on first retain, so a failed setup is not fatal — retry next time.
        bankReady = null;
        console.warn("Hindsight bank setup failed:", (err as Error).message);
      });
  }
  return bankReady;
}

// ---------------------------------------------------------------------------
// STATUS
// ---------------------------------------------------------------------------

let statusCache: { at: number; status: MemoryProviderStatus } | null = null;

export async function getMemoryStatus(): Promise<MemoryProviderStatus> {
  const config = getConfig();
  if (!config) {
    return {
      provider: "hindsight",
      connected: false,
      mode: "not-configured",
      message: "Hindsight is not configured. Add HINDSIGHT_API_KEY to .env to enable memory.",
    };
  }

  if (statusCache && Date.now() - statusCache.at < 30_000) return statusCache.status;

  let status: MemoryProviderStatus;
  try {
    await ensureBank(config);
    await hindsightFetch(config, "/stats", { method: "GET", timeoutMs: 8_000 });
    status = {
      provider: "hindsight",
      connected: true,
      mode: "live",
      message: `Connected to Hindsight at ${config.baseUrl} (bank: ${config.bankId}).`,
    };
  } catch (err) {
    status = {
      provider: "hindsight",
      connected: false,
      mode: "unreachable",
      message: (err as Error).message,
    };
  }
  statusCache = { at: Date.now(), status };
  return status;
}

// ---------------------------------------------------------------------------
// RETAIN — store a proposal experience
// ---------------------------------------------------------------------------

const tagSlug = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-");

function memoryToText(memory: Memory): string {
  return [
    `Proposal outcome record: "${memory.title}" for ${memory.clientType || "a client"} in the ${memory.industry} industry.`,
    `Outcome: ${memory.outcome.toUpperCase()}.`,
    memory.rfpContext ? `RFP context: ${memory.rfpContext}` : "",
    memory.strategy ? `Proposal strategy used: ${memory.strategy}` : "",
    memory.content ? `Summary: ${memory.content}` : "",
    memory.successfulPatterns.length ? `What worked: ${memory.successfulPatterns.join(", ")}.` : "",
    memory.failedPatterns.length ? `What failed: ${memory.failedPatterns.join(", ")}.` : "",
    memory.lessons.length
      ? `Lessons learned:\n${memory.lessons.map((l) => `- ${l}`).join("\n")}`
      : "",
    memory.clientPreferences?.length
      ? `Client preferences: ${memory.clientPreferences.join("; ")}.`
      : "",
    memory.recommendations?.length
      ? `Recommendations for future similar proposals:\n${memory.recommendations.map((r) => `- ${r}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function retainMemory(memory: Memory): Promise<Memory> {
  const config = requireConfig();
  await ensureBank(config);

  await hindsightFetch(config, "/memories", {
    method: "POST",
    // Synchronous so the experience is recallable immediately after the outcome is recorded.
    timeoutMs: 90_000,
    body: {
      async: false,
      items: [
        {
          content: memoryToText(memory),
          context: `${memory.industry} proposal outcome (${memory.outcome})`,
          // One document per proposal: re-recording an outcome replaces the earlier memory.
          document_id: memory.sourceProposalId ? `proposal-${memory.sourceProposalId}` : memory.id,
          timestamp: memory.createdAt,
          tags: [
            "proposal-outcome",
            `industry:${tagSlug(memory.industry)}`,
            `outcome:${memory.outcome}`,
          ],
          metadata: {
            memory_id: memory.id,
            title: memory.title,
            source_proposal_id: memory.sourceProposalId,
            industry: memory.industry,
            outcome: memory.outcome,
            client: memory.clientType,
            summary: memory.content,
            lessons: JSON.stringify(memory.lessons),
            successful_patterns: JSON.stringify(memory.successfulPatterns),
            failed_patterns: JSON.stringify(memory.failedPatterns),
            client_preferences: JSON.stringify(memory.clientPreferences ?? []),
            recommendations: JSON.stringify(memory.recommendations ?? []),
            rfp_context: memory.rfpContext ?? "",
            created_at: memory.createdAt,
          },
        },
      ],
    },
  });

  // Mirror only after Hindsight accepted it.
  const existingIdx = memories.findIndex((m) => m.id === memory.id);
  if (existingIdx >= 0) memories[existingIdx] = memory;
  else memories.unshift(memory);
  await saveStore();

  return memory;
}

// ---------------------------------------------------------------------------
// RECALL — retrieve relevant experiences for an RFP
// ---------------------------------------------------------------------------

export interface RecallQuery {
  industry?: string | undefined;
  clientName?: string | undefined;
  text: string;
  limit?: number | undefined;
}

interface HindsightFact {
  id: string;
  text: string;
  type?: string;
  context?: string | null;
  metadata?: Record<string, string> | null;
  tags?: string[] | null;
  document_id?: string | null;
  scores?: unknown;
}

const parseList = (value: string | undefined): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
};

const OUTCOMES: Outcome[] = ["won", "lost", "pending"];

function outcomeOf(fact: HindsightFact): Outcome {
  const meta = fact.metadata?.["outcome"];
  if (meta && OUTCOMES.includes(meta as Outcome)) return meta as Outcome;
  const tag = fact.tags?.find((t) => t.startsWith("outcome:"))?.slice("outcome:".length);
  if (tag && OUTCOMES.includes(tag as Outcome)) return tag as Outcome;
  return /\blost\b/i.test(fact.text) ? "lost" : /\bwon\b/i.test(fact.text) ? "won" : "pending";
}

/** Relevance 0..1 from Hindsight's per-fact `scores` (semantic similarity when present). */
function scoreOf(scores: unknown): number | null {
  if (typeof scores === "number") return scores >= 0 && scores <= 1 ? scores : null;
  if (!scores || typeof scores !== "object") return null;
  const semantic = (scores as Record<string, unknown>)["semantic"];
  if (typeof semantic === "number" && semantic >= 0 && semantic <= 1) return semantic;
  const valid = Object.values(scores).filter(
    (n): n is number => typeof n === "number" && n >= 0 && n <= 1,
  );
  return valid.length ? Math.max(...valid) : null;
}

function recallQueryText(query: RecallQuery): string {
  // Hindsight caps queries at ~500 tokens; the head of the RFP carries most of the signal.
  const head = [
    query.industry ? `Industry: ${query.industry}.` : "",
    query.clientName ? `Client: ${query.clientName}.` : "",
    "Past proposal outcomes, what worked, what failed and lessons relevant to this RFP:",
  ]
    .filter(Boolean)
    .join(" ");
  return `${head}\n${query.text.slice(0, 1500)}`;
}

export async function recallMemories(query: RecallQuery): Promise<RecalledMemory[]> {
  const config = requireConfig();

  const data = await hindsightFetch<{ results?: HindsightFact[] }>(config, "/memories/recall", {
    method: "POST",
    body: {
      query: recallQueryText(query),
      budget: "mid",
      max_tokens: 4096,
      // Observations are Hindsight's cross-document summaries; they carry no document id or
      // metadata, so they can't be attributed to a specific past proposal.
      types: ["world", "experience"],
    },
  });

  // Hindsight returns extracted facts; group them back into the proposal experiences they came from.
  const groups = new Map<string, HindsightFact[]>();
  for (const fact of data.results ?? []) {
    const key = fact.metadata?.["memory_id"] || fact.document_id || fact.id;
    groups.set(key, [...(groups.get(key) ?? []), fact]);
  }

  const total = groups.size;
  return Array.from(groups.entries())
    .map(([key, facts], rank): RecalledMemory => {
      const first = facts[0]!;
      const meta = facts.find((f) => f.metadata?.["memory_id"])?.metadata ?? first.metadata ?? {};
      const mirror = memories.find((m) => m.id === meta["memory_id"]);
      const industry = (meta["industry"] ||
        mirror?.industry ||
        query.industry ||
        "Other") as Industry;
      const scores = facts.map((f) => scoreOf(f.scores)).filter((s): s is number => s !== null);
      const score = scores.length ? Math.max(...scores) : null;

      const reasons: string[] = [];
      if (query.industry && industry.toLowerCase() === query.industry.toLowerCase()) {
        reasons.push(`Same industry (${industry})`);
      }
      reasons.push(...facts.slice(0, 3).map((f) => `Hindsight recalled: ${f.text}`));

      return {
        id: meta["memory_id"] || key,
        title: meta["title"] || mirror?.title || first.context || "Recalled experience",
        sourceProposalId: meta["source_proposal_id"] || mirror?.sourceProposalId || "",
        industry,
        outcome: outcomeOf(first),
        clientType: meta["client"] || mirror?.clientType || "",
        content: meta["summary"] || mirror?.content || facts.map((f) => f.text).join(" "),
        lessons: parseList(meta["lessons"]).length
          ? parseList(meta["lessons"])
          : (mirror?.lessons ?? []),
        successfulPatterns: parseList(meta["successful_patterns"]).length
          ? parseList(meta["successful_patterns"])
          : (mirror?.successfulPatterns ?? []),
        failedPatterns: parseList(meta["failed_patterns"]).length
          ? parseList(meta["failed_patterns"])
          : (mirror?.failedPatterns ?? []),
        clientPreferences: parseList(meta["client_preferences"]).length
          ? parseList(meta["client_preferences"])
          : (mirror?.clientPreferences ?? []),
        recommendations: parseList(meta["recommendations"]).length
          ? parseList(meta["recommendations"])
          : (mirror?.recommendations ?? []),
        rfpContext: meta["rfp_context"] || mirror?.rfpContext || "",
        createdAt: meta["created_at"] || mirror?.createdAt || new Date().toISOString(),
        // Hindsight orders results by relevance; use its score when present, otherwise rank.
        relevance: score ?? Math.max(0.3, 0.95 - (rank / Math.max(1, total)) * 0.6),
        relevanceReasons: reasons,
        factIds: facts.map((f) => f.id),
      };
    })
    .sort((x, y) => y.relevance - x.relevance)
    .slice(0, query.limit ?? 5);
}

// ---------------------------------------------------------------------------
// REFLECT — synthesise recalled experiences into a proposal strategy
// ---------------------------------------------------------------------------

const REFLECT_SCHEMA = {
  type: "object",
  properties: {
    strategy: {
      type: "string",
      description: "3-4 sentence strategy for the new proposal, grounded in past outcomes.",
    },
    successfulPatterns: {
      type: "array",
      items: { type: "string" },
      description: "Approaches to repeat because they contributed to wins.",
    },
    warnings: {
      type: "array",
      items: { type: "string" },
      description: "Pitfalls to avoid because they contributed to losses.",
    },
    reasoning: {
      type: "array",
      items: { type: "string" },
      description:
        "'Why this proposal' bullets, each naming the past proposal and outcome it is based on.",
    },
  },
  required: ["strategy", "successfulPatterns", "warnings", "reasoning"],
};

interface ReflectResponse {
  text?: string;
  structured_output?: {
    strategy?: string;
    successfulPatterns?: string[];
    warnings?: string[];
    reasoning?: string[];
  } | null;
  based_on?: unknown;
}

const strings = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((s): s is string => typeof s === "string" && !!s.trim()) : [];

/** Collect memory_id / document_id references from reflect's `based_on`, whatever its nesting. */
function referencedIds(basedOn: unknown): Set<string> {
  const ids = new Set<string>();
  const walk = (node: unknown) => {
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") {
      const obj = node as Record<string, unknown>;
      const meta = obj["metadata"] as Record<string, unknown> | undefined;
      for (const v of [meta?.["memory_id"], obj["document_id"], obj["id"]])
        if (typeof v === "string") ids.add(v);
      Object.values(obj).forEach(walk);
    }
  };
  walk(basedOn);
  return ids;
}

export async function reflectOnMemories(
  analysis: RFPAnalysis,
  recalled: RecalledMemory[],
): Promise<AgentRecommendation> {
  const wins = recalled.filter((m) => m.outcome === "won");
  const losses = recalled.filter((m) => m.outcome === "lost");

  if (recalled.length === 0) {
    return {
      summary: "No previous experiences in Hindsight match this RFP yet.",
      strategy:
        "This is the first proposal of its kind in memory, so it is generated from the RFP analysis alone. Record its outcome to teach the agent for next time.",
      successfulPatterns: [],
      warnings: [],
      reasoning: [],
      source: "none",
      basedOn: [],
    };
  }

  const config = getConfig();
  if (config) {
    try {
      const query = [
        `A new ${analysis.industry} RFP from ${analysis.client} has arrived.`,
        `Key requirements: ${analysis.keyRequirements.slice(0, 5).join("; ")}.`,
        `Compliance: ${analysis.complianceRequirements.slice(0, 3).join("; ")}.`,
        `Evaluation criteria: ${analysis.evaluationCriteria.slice(0, 3).join("; ")}.`,
        "Based on our past proposal outcomes, how should this proposal be written?",
        "What should we repeat from proposals we won, what should we avoid from proposals we lost, and why?",
      ].join(" ");

      const data = await hindsightFetch<ReflectResponse>(config, "/reflect", {
        method: "POST",
        timeoutMs: 60_000,
        body: {
          query,
          budget: "mid",
          max_tokens: 2048,
          response_schema: REFLECT_SCHEMA,
          include: { facts: {} },
        },
      });

      const out = data.structured_output ?? {};
      const strategy = out.strategy?.trim() || data.text?.trim();
      if (strategy) {
        const refs = referencedIds(data.based_on);
        const cited = recalled.filter(
          (m) =>
            refs.has(m.id) ||
            refs.has(`proposal-${m.sourceProposalId}`) ||
            !!m.factIds?.some((id) => refs.has(id)),
        );
        return {
          summary: `Hindsight reflected on ${recalled.length} relevant experience${recalled.length === 1 ? "" : "s"} (${wins.length} won, ${losses.length} lost).`,
          strategy,
          successfulPatterns: strings(out.successfulPatterns).slice(0, 6),
          warnings: strings(out.warnings).slice(0, 4),
          reasoning: strings(out.reasoning).slice(0, 6),
          source: "hindsight-reflect",
          basedOn: cited.length ? cited : recalled,
        };
      }
    } catch (err) {
      console.warn(
        "Hindsight reflect failed, using LLM over recalled memories:",
        (err as Error).message,
      );
    }
  }

  if (getLLMConfig()) {
    try {
      return await llmReflect(analysis, recalled);
    } catch (err) {
      console.warn("LLM reflection failed:", (err as Error).message);
    }
  }

  // No reasoning engine available: report the recalled evidence as-is.
  return {
    summary: `${recalled.length} relevant experience${recalled.length === 1 ? "" : "s"} recalled from Hindsight (${wins.length} won, ${losses.length} lost).`,
    strategy: [
      wins.length
        ? `Repeat: ${rank(wins.flatMap((m) => m.successfulPatterns))
            .slice(0, 4)
            .join(", ")}.`
        : "",
      losses.length
        ? `Avoid: ${rank(losses.flatMap((m) => m.lessons))
            .slice(0, 2)
            .join(" ")}`
        : "",
    ]
      .filter(Boolean)
      .join(" "),
    successfulPatterns: rank(wins.flatMap((m) => m.successfulPatterns)).slice(0, 6),
    warnings: rank(losses.flatMap((m) => m.lessons)).slice(0, 4),
    reasoning: recalled.map(
      (m) => `${m.title} (${m.outcome.toUpperCase()}): ${m.lessons[0] ?? m.content}`,
    ),
    source: "none",
    basedOn: recalled,
  };
}

async function llmReflect(
  analysis: RFPAnalysis,
  recalled: RecalledMemory[],
): Promise<AgentRecommendation> {
  const memoryContext = recalled
    .map(
      (m, i) =>
        `[Memory ${i + 1}] ${m.title} — ${m.outcome.toUpperCase()} (${m.industry})\n` +
        `  Lessons: ${m.lessons.join("; ") || "N/A"}\n` +
        `  What worked: ${m.successfulPatterns.join(", ") || "N/A"}\n` +
        `  What failed: ${m.failedPatterns.join(", ") || "N/A"}\n` +
        `  Recommendations for next time: ${m.recommendations?.join("; ") || "N/A"}`,
    )
    .join("\n\n");

  const systemPrompt = `You are an expert proposal strategist. Using ONLY the recalled past proposal experiences provided, return JSON:
{"strategy": string (3-4 specific sentences), "successfulPatterns": string[], "warnings": string[], "reasoning": string[] (each bullet names the past proposal and outcome it comes from)}
Return ONLY valid JSON.`;

  const prompt = `New RFP:
Industry: ${analysis.industry}
Client: ${analysis.client}
Key Requirements: ${analysis.keyRequirements.slice(0, 4).join("; ")}
Compliance: ${analysis.complianceRequirements.slice(0, 3).join("; ")}
Evaluation Criteria: ${analysis.evaluationCriteria.slice(0, 3).join("; ")}

Recalled Hindsight memories:
${memoryContext}`;

  const text = await callLLM(prompt, systemPrompt, { json: true });
  const parsed = JSON.parse(
    text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim(),
  );
  const wins = recalled.filter((m) => m.outcome === "won");
  const losses = recalled.filter((m) => m.outcome === "lost");

  return {
    summary: `${recalled.length} relevant experience${recalled.length === 1 ? "" : "s"} recalled from Hindsight — strategy synthesised from ${wins.length} wins and ${losses.length} losses.`,
    strategy: String(parsed.strategy ?? "").trim(),
    successfulPatterns: strings(parsed.successfulPatterns).slice(0, 6),
    warnings: strings(parsed.warnings).slice(0, 4),
    reasoning: strings(parsed.reasoning).slice(0, 6),
    source: "llm",
    basedOn: recalled,
  };
}

function rank(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const v of values) if (v.trim()) counts.set(v, (counts.get(v) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([v]) => v);
}
