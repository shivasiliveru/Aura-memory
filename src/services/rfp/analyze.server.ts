import type { Industry, RFPAnalysis } from "@/types";

/**
 * RFP processing service.
 *
 * This is a deterministic text-extraction pass, not an LLM call. When an LLM is
 * connected after export, replace the body of `analyzeRFP` — the interface is
 * what the rest of the app depends on.
 */

const SIGNALS: Record<string, string[]> = {
  technical: ["integration", "api", "architecture", "migration", "latency", "uptime", "scalab", "cloud", "data model"],
  compliance: ["hipaa", "soc 2", "gdpr", "pci", "audit", "compliance", "regulat", "privacy", "iso 27001"],
  security: ["security", "encryption", "access control", "penetration", "zero trust"],
  evaluation: ["evaluation", "scoring", "criteria", "weighted", "shortlist"],
};

function sentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20);
}

function pick(list: string[], signals: string[], limit = 5): string[] {
  return list.filter((s) => signals.some((k) => s.toLowerCase().includes(k))).slice(0, limit);
}

export interface AnalyzeInput {
  title: string;
  clientName: string;
  industry: Industry;
  deadline?: string;
  content: string;
}

export function analyzeRFP(input: AnalyzeInput): RFPAnalysis {
  const list = sentences(input.content);
  const bullets = list.filter((s) => /\b(must|shall|require|need|expect)\b/i.test(s)).slice(0, 6);

  const technical = pick(list, SIGNALS.technical);
  const compliance = pick(list, [...SIGNALS.compliance, ...SIGNALS.security]);
  const evaluation = pick(list, SIGNALS.evaluation, 4);

  const words = input.content
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 5);
  const counts = new Map<string, number>();
  for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  const keywords = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);

  const timelineMatch = input.content.match(
    /(\d+\s*(?:weeks?|months?|days?)|Q[1-4]\s*20\d\d|by\s+\w+\s+\d{1,2})/i,
  );

  return {
    client: input.clientName,
    industry: input.industry,
    keyRequirements: bullets.length
      ? bullets
      : list.slice(0, 4).length
        ? list.slice(0, 4)
        : ["No explicit requirements detected in the supplied text."],
    technicalRequirements: technical.length ? technical : ["No specific technical requirements detected."],
    complianceRequirements: compliance.length ? compliance : ["No explicit compliance requirements detected."],
    timeline: input.deadline
      ? `Submission due ${input.deadline}${timelineMatch ? ` · delivery signal: ${timelineMatch[0]}` : ""}`
      : timelineMatch
        ? `Delivery signal: ${timelineMatch[0]}`
        : "No timeline stated in the RFP.",
    evaluationCriteria: evaluation.length
      ? evaluation
      : ["Evaluation criteria not stated — assume price, capability and risk."],
    keywords,
  };
}
