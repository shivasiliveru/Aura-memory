import type {
  AgentRecommendation,
  Industry,
  ProposalSection,
  RFPAnalysis,
  RecalledMemory,
} from "@/types";

export interface LLMConfig {
  provider: "openai" | "gemini" | "anthropic" | "custom";
  apiKey: string;
  model: string;
  baseUrl: string;
}

export function getLLMConfig(): LLMConfig | null {
  const apiKey =
    process.env["LLM_API_KEY"] ||
    process.env["OPENAI_API_KEY"] ||
    process.env["GEMINI_API_KEY"] ||
    process.env["ANTHROPIC_API_KEY"];

  if (!apiKey) return null;

  const provider = (process.env["LLM_PROVIDER"] as LLMConfig["provider"]) || "openai";
  const model =
    process.env["LLM_MODEL"] ||
    (provider === "gemini"
      ? "gemini-1.5-pro"
      : provider === "anthropic"
        ? "claude-3-5-sonnet-20241022"
        : "gpt-4o");
  const baseUrl = process.env["LLM_BASE_URL"] || "https://api.openai.com/v1";

  return { provider, apiKey, model, baseUrl };
}

export interface LLMCallOptions {
  /** Ask the provider for a JSON object response (OpenAI-compatible providers). */
  json?: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Retries rate limits (429) and transient 5xx errors, honouring the provider's retry hint.
 * Free-tier providers (e.g. Groq's 8k tokens/minute) hit this during a normal demo flow.
 */
async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  const MAX_ATTEMPTS = 4;
  let totalWaitMs = 0;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, init);
    const retryable = res.status === 429 || res.status >= 500;
    if (res.ok || !retryable || attempt === MAX_ATTEMPTS) return res;

    const body = await res.clone().text();
    const header = Number(res.headers.get("retry-after"));
    const hinted = body.match(/try again in ([\d.]+)s/i);
    const waitMs = Math.ceil(
      (Number.isFinite(header) && header > 0 ? header : hinted ? Number(hinted[1]) : 2 ** attempt) *
        1000 +
        500,
    );
    if (totalWaitMs + waitMs > 60_000) return res;
    totalWaitMs += waitMs;
    console.warn(`LLM HTTP ${res.status}; retrying in ${Math.round(waitMs / 1000)}s`);
    await sleep(waitMs);
  }
}

export async function callLLM(
  prompt: string,
  systemPrompt?: string,
  options: LLMCallOptions = {},
): Promise<string> {
  const config = getLLMConfig();
  if (!config) {
    throw new Error("No LLM API key configured.");
  }

  if (config.provider === "gemini") {
    // Google Gemini REST API format
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=${config.apiKey}`;
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          ...(systemPrompt
            ? [{ role: "user", parts: [{ text: `SYSTEM DIRECTIVE: ${systemPrompt}` }] }]
            : []),
          { role: "user", parts: [{ text: prompt }] },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  } else if (config.provider === "anthropic") {
    // Anthropic Claude REST API format
    const url = "https://api.anthropic.com/v1/messages";
    const res = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Anthropic API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || "";
  } else {
    // OpenAI or OpenAI-compatible format
    const url = `${config.baseUrl.replace(/\/$/, "")}/chat/completions`;
    // Providers rate-limit per model, so a fallback model keeps the app answering when the
    // primary is exhausted (e.g. Groq's free-tier daily token cap).
    const models = [config.model, process.env["LLM_FALLBACK_MODEL"]].filter(
      (m): m is string => !!m,
    );
    let res!: Response;
    for (const [i, model] of models.entries()) {
      // gpt-oss models reason before answering; low effort keeps answers fast and within
      // the output budget (high effort truncated 11-section proposals).
      const reasoningEffort =
        process.env["LLM_REASONING_EFFORT"] || (/gpt-oss/i.test(model) ? "low" : "");
      res = await fetchWithRetry(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          ...(reasoningEffort ? { reasoning_effort: reasoningEffort } : {}),
          ...(options.json ? { response_format: { type: "json_object" } } : {}),
        }),
      });
      if (res.status !== 429 || i === models.length - 1) break;
      console.warn(`LLM model ${model} is rate-limited; falling back to ${models[i + 1]}.`);
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`LLM API error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || "";
  }
}

/** The submitted text is not a business request for proposal (e.g. a personal question). */
export class NotAnRfpError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "NotAnRfpError";
  }
}

export async function analyzeRFPWithLLM(
  content: string,
  title: string,
  clientName: string,
  industry: Industry,
): Promise<RFPAnalysis> {
  const systemPrompt = `You are an expert Proposal Intelligence RFP Analyst. Analyze the provided Request for Proposal (RFP) document and extract structured JSON matching exact schema keys:
{
  "isRfp": boolean,
  "notRfpReason": string,
  "client": string,
  "industry": string,
  "keyRequirements": string[],
  "technicalRequirements": string[],
  "complianceRequirements": string[],
  "timeline": string,
  "evaluationCriteria": string[],
  "keywords": string[]
}
First decide "isRfp": true if the text describes an organisation's business need for a product, service or project that a vendor could propose on (a formal RFP, tender, RFQ, project brief, or even a one-line business requirement). false for personal questions, medical/health advice requests, chit-chat, or anything no vendor could write a proposal for. When false, give a one-sentence "notRfpReason" and leave the other fields empty — do NOT invent requirements.
Return ONLY valid JSON.`;

  const prompt = `Client: ${clientName}
Industry: ${industry}
RFP Title: ${title}

RFP Content:
${content}`;

  const text = await callLLM(prompt, systemPrompt, { json: true });
  const cleanJson = text
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const parsed = JSON.parse(cleanJson);

  if (parsed.isRfp === false) {
    throw new NotAnRfpError(
      String(parsed.notRfpReason || "This text does not describe a business need to propose on."),
    );
  }

  return {
    client: parsed.client || clientName,
    industry: (parsed.industry || industry) as Industry,
    keyRequirements: Array.isArray(parsed.keyRequirements) ? parsed.keyRequirements : [],
    technicalRequirements: Array.isArray(parsed.technicalRequirements)
      ? parsed.technicalRequirements
      : [],
    complianceRequirements: Array.isArray(parsed.complianceRequirements)
      ? parsed.complianceRequirements
      : [],
    timeline: parsed.timeline || "Not specified",
    evaluationCriteria: Array.isArray(parsed.evaluationCriteria) ? parsed.evaluationCriteria : [],
    keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
  };
}

export async function generateProposalSectionsWithLLM(input: {
  title: string;
  clientName: string;
  analysis: RFPAnalysis;
  recommendation: AgentRecommendation;
  recalledMemories: RecalledMemory[];
  useMemory: boolean;
  /** Section titles to write, in order. */
  sections: readonly string[];
}): Promise<ProposalSection[]> {
  const { title, clientName, analysis, recommendation, recalledMemories, useMemory } = input;
  const sectionList = input.sections.map((t, i) => `${i + 1}. ${t}`).join("\n");

  const memoriesSummary =
    useMemory && recalledMemories.length > 0
      ? recalledMemories
          .map(
            (m, idx) =>
              `[Memory ${idx + 1}] ID: ${m.id} | Title: ${m.title} | Outcome: ${m.outcome.toUpperCase()} | Industry: ${m.industry}
Lessons: ${m.lessons.join("; ")}
Successful Factors: ${m.successfulPatterns.join(", ")}
Failed Factors: ${m.failedPatterns.join(", ")}
Client Preferences: ${m.clientPreferences?.join("; ") || "N/A"}
Recommendations for next time: ${m.recommendations?.join("; ") || "N/A"}
Content: ${m.content}`,
          )
          .join("\n\n")
      : "No previous experiences used (Demo baseline state).";

  const systemPrompt = `You are a world-class AI Proposal & RFP Writer.
Generate a comprehensive, highly customized proposal composed of exactly these ${input.sections.length} sections, with these exact titles, in this order:
${sectionList}
Write every listed section — never stop early. Keep each section focused (roughly 80-200 words) so all of them fit.

CRITICAL REQUIREMENT:
If memories/recalled experiences are provided, you MUST actively apply their lessons:
- Emphasize successful patterns (e.g. security architecture, compliance, detailed timelines).
- Avoid past failure pitfalls (e.g. generic pricing, vague ROI, conceptual plans).
- Reference memory IDs in the informedBy array for sections that were influenced by memory.

Return ONLY a JSON object with schema:
{
  "sections": [
    {
      "id": string (slugified title),
      "title": string,
      "content": string,
      "informedBy": string[] (array of memory IDs used)
    }
  ]
}`;

  const prompt = `RFP Title: ${title}
Client: ${clientName}
Industry: ${analysis.industry}

RFP Analysis:
Key Requirements: ${analysis.keyRequirements.join("; ")}
Technical Requirements: ${analysis.technicalRequirements.join("; ")}
Compliance Requirements: ${analysis.complianceRequirements.join("; ")}
Timeline: ${analysis.timeline}
Evaluation Criteria: ${analysis.evaluationCriteria.join("; ")}

Agent Recommendation / Memory Strategy:
${recommendation.strategy}

Recalled Previous Experiences (Hindsight Memory):
${memoriesSummary}`;

  const text = await callLLM(prompt, systemPrompt, { json: true });
  const cleanJson = text
    .replace(/^```json\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  const raw = JSON.parse(cleanJson);
  const parsed = Array.isArray(raw) ? raw : raw?.sections;

  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed.map(
      (sec: { id?: string; title: string; content: string; informedBy?: string[] }) => ({
        id: sec.id || sec.title.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        title: sec.title,
        content: sec.content,
        informedBy: Array.isArray(sec.informedBy) ? sec.informedBy : [],
      }),
    );
  }

  throw new Error("Invalid response format from LLM for proposal sections");
}
