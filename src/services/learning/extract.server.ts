import type { Outcome, Proposal } from "@/types";
import { callLLM, getLLMConfig } from "@/services/ai/llm.server";
import { LOST_FACTOR_OPTIONS, WON_FACTOR_OPTIONS } from "@/lib/outcome-factors";

/**
 * Learning extraction: turns a proposal + its outcome + the user's feedback into
 * structured, reusable lessons before they are retained in Hindsight.
 */

export interface OutcomeFeedback {
  status: Outcome;
  successfulFactors: string[];
  failureFactors: string[];
  lessons: string;
}

export interface ExtractedLearning {
  summary: string;
  lessons: string[];
  successfulPatterns: string[];
  failedPatterns: string[];
  clientPreferences: string[];
  recommendations: string[];
  rfpContext: string;
  extractedBy: "llm" | "user";
}

const strings = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.filter((s): s is string => typeof s === "string" && !!s.trim()).map((s) => s.trim())
    : [];

/** Dedupes ignoring case, spacing and punctuation ("NamedWorkstreamLeads" = "Named Workstream Leads"); first spelling wins. */
const unique = (values: string[]) => {
  const seen = new Map<string, string>();
  for (const v of values) {
    const key = v.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (key && !seen.has(key)) seen.set(key, v);
  }
  return Array.from(seen.values());
};

function parseJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("LLM did not return a JSON object");
  return JSON.parse(text.slice(start, end + 1));
}

function proposalDigest(proposal: Proposal): string {
  // Keep the prompt bounded: the opening of each section shows the approach taken.
  return proposal.sections
    .map((s) => `## ${s.title}\n${s.content.slice(0, 400)}`)
    .join("\n\n")
    .slice(0, 6000);
}

/** Uses only what the user entered — no invented lessons. */
function fromFeedback(proposal: Proposal, feedback: OutcomeFeedback): ExtractedLearning {
  const lessons = feedback.lessons
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  return {
    summary: lessons[0] ?? `Outcome recorded for ${proposal.title}.`,
    lessons,
    successfulPatterns: feedback.successfulFactors,
    failedPatterns: feedback.failureFactors,
    clientPreferences: [],
    recommendations: [],
    rfpContext: proposal.rfpContent.slice(0, 500),
    extractedBy: "user",
  };
}

export async function extractLearning(
  proposal: Proposal,
  feedback: OutcomeFeedback,
): Promise<ExtractedLearning> {
  const base = fromFeedback(proposal, feedback);
  if (!getLLMConfig()) return base;

  const systemPrompt = `You are a proposal debrief analyst. From a submitted proposal, its RFP, its outcome and the team's feedback, extract lessons that will help write better proposals for future, similar RFPs.
Rules:
- Ground every item in the provided feedback, RFP or proposal text. Do not invent facts, numbers or client statements.
- The team's feedback is the strongest signal for WHY the outcome happened; the proposal text shows WHAT approach was used.
- For PENDING outcomes, describe the approach taken and early signals only — do not claim it worked or failed.
- Write each item as a short, specific, reusable sentence (not a generic best practice).
- For successfulPatterns / failedPatterns, reuse these standard labels exactly when one fits, and only add a new short label when none does:
  Helped: ${WON_FACTOR_OPTIONS.join("; ")}
  Hurt: ${LOST_FACTOR_OPTIONS.join("; ")}
Return ONLY a JSON object:
{
  "summary": string (2-3 sentences: what was proposed, the outcome, and the main reason),
  "rfpContext": string (1-2 sentences: client type, need, key constraints),
  "lessons": string[] (3-5),
  "successfulPatterns": string[] (approaches that helped; short labels),
  "failedPatterns": string[] (approaches that hurt; short labels),
  "clientPreferences": string[] (what this client/industry evidently values),
  "recommendations": string[] (2-4 concrete instructions for the next similar proposal)
}`;

  const prompt = `Proposal: ${proposal.title}
Client: ${proposal.clientName}
Industry: ${proposal.industry}
Outcome: ${feedback.status.toUpperCase()}

Team feedback:
- Factors that helped: ${feedback.successfulFactors.join(", ") || "none given"}
- Factors that hurt: ${feedback.failureFactors.join(", ") || "none given"}
- Notes: ${feedback.lessons || "none given"}

Strategy used: ${proposal.strategy || "not recorded"}

RFP text:
${proposal.rfpContent.slice(0, 3000)}

Submitted proposal (section openings):
${proposalDigest(proposal) || "No section content saved."}`;

  try {
    const parsed = parseJsonObject(await callLLM(prompt, systemPrompt, { json: true }));
    return {
      summary: typeof parsed["summary"] === "string" ? parsed["summary"].trim() : base.summary,
      rfpContext:
        typeof parsed["rfpContext"] === "string" ? parsed["rfpContext"].trim() : base.rfpContext,
      // The user's own words stay first; the LLM adds to them rather than replacing them.
      lessons: unique([...base.lessons, ...strings(parsed["lessons"])]).slice(0, 8),
      successfulPatterns: unique([
        ...feedback.successfulFactors,
        ...strings(parsed["successfulPatterns"]),
      ]),
      failedPatterns: unique([...feedback.failureFactors, ...strings(parsed["failedPatterns"])]),
      clientPreferences: strings(parsed["clientPreferences"]).slice(0, 5),
      recommendations: strings(parsed["recommendations"]).slice(0, 4),
      extractedBy: "llm",
    };
  } catch (err) {
    console.warn("Learning extraction failed, retaining user feedback as entered:", err);
    return base;
  }
}
