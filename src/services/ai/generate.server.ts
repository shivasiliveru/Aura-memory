import type { AgentRecommendation, ProposalSection, RFPAnalysis, RecalledMemory } from "@/types";
import { callLLM, generateProposalSectionsWithLLM, getLLMConfig } from "./llm.server";

/**
 * AI Proposal Generation Service
 *
 * Integrates LLM reasoning with Hindsight memory context to generate tailored proposals.
 * Falls back to structured template generation when no LLM API key is present.
 */

export const SECTION_TITLES = [
  "Executive Summary",
  "Understanding of Requirements",
  "Proposed Solution",
  "Technical Approach",
  "Security & Compliance",
  "Implementation Plan",
  "Timeline",
  "Team",
  "Pricing",
  "ROI / Business Value",
  "Conclusion",
] as const;

export type SectionTitle = (typeof SECTION_TITLES)[number];

export interface GenerateInput {
  title: string;
  clientName: string;
  analysis: RFPAnalysis;
  recommendation: AgentRecommendation;
  /** When false, generate without using any recalled experience (demo "before" state). */
  useMemory: boolean;
}

const slug = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

export async function generateProposalSections(input: GenerateInput): Promise<ProposalSection[]> {
  if (getLLMConfig()) {
    try {
      const recalledMemories: RecalledMemory[] = input.useMemory
        ? input.recommendation.basedOn
        : [];
      return await generateProposalSectionsWithLLM({
        title: input.title,
        clientName: input.clientName,
        analysis: input.analysis,
        recommendation: input.recommendation,
        recalledMemories,
        useMemory: input.useMemory,
      });
    } catch (err) {
      console.warn(
        "LLM proposal section generation failed, falling back to structured generator:",
        err,
      );
    }
  }

  return localGenerateProposalSections(input);
}

function localGenerateProposalSections(input: GenerateInput): ProposalSection[] {
  const { analysis, recommendation, clientName, useMemory } = input;
  const memoryIds = useMemory ? recommendation.basedOn.map((m) => m.id) : [];
  const wins = useMemory ? recommendation.basedOn.filter((m) => m.outcome === "won") : [];
  const losses = useMemory ? recommendation.basedOn.filter((m) => m.outcome === "lost") : [];
  const emphasis = useMemory ? recommendation.successfulPatterns : [];

  const body: Record<SectionTitle, string> = {
    "Executive Summary": useMemory
      ? `${clientName} is looking for a partner that can deliver against the requirements in this RFP with minimal risk. Across ${recommendation.basedOn.length} comparable ${analysis.industry} engagements we have learned exactly what decides these evaluations: ${emphasis.join(", ").toLowerCase() || "clarity and evidence"}. This proposal leads with those, and quantifies every claim.`
      : `${clientName} is looking for a partner to deliver the scope described in this RFP. We have relevant experience in ${analysis.industry} and propose a phased engagement covering discovery, delivery and support.`,

    "Understanding of Requirements": [
      `Our reading of the RFP:`,
      ...analysis.keyRequirements.map((r) => `• ${r}`),
    ].join("\n"),

    "Proposed Solution": useMemory
      ? `A phased solution shaped by what worked previously in ${analysis.industry}: ${emphasis.slice(0, 3).join(", ").toLowerCase() || "a staged rollout"}. Each phase ends in a demonstrable outcome for ${clientName}, not a status report.`
      : `A phased solution covering platform setup, integration, rollout and support, delivered by a dedicated team.`,

    "Technical Approach": [
      useMemory
        ? "Technical detail is scored heavily in comparable evaluations, so each requirement below is answered with a named component and an owner."
        : "Our technical approach addresses the stated requirements:",
      ...analysis.technicalRequirements.map((r) => `• ${r}`),
    ].join("\n"),

    "Security & Compliance": useMemory
      ? [
          `Security architecture, data-privacy controls and compliance evidence are presented up front — the pattern that carried our successful ${analysis.industry} bids.`,
          ...analysis.complianceRequirements.map((r) => `• ${r}`),
          "A named security lead owns this workstream for the duration of the engagement.",
        ].join("\n")
      : [
          "We follow industry-standard security practices and applicable regulations.",
          ...analysis.complianceRequirements.map((r) => `• ${r}`),
        ].join("\n"),

    "Implementation Plan": useMemory
      ? "Four waves, each with named owners, entry and exit criteria, and a rollback plan. Previous wins turned on this level of specificity; a previous loss came from leaving the plan conceptual."
      : "Implementation will proceed in phases agreed during the kickoff workshop.",

    Timeline: `${analysis.timeline}\n\nPhase 1 Discovery (weeks 1-3) · Phase 2 Build (weeks 4-12) · Phase 3 Pilot (weeks 13-16) · Phase 4 Rollout (weeks 17-24).`,

    Team: `A dedicated delivery pod: engagement lead, solution architect, ${analysis.industry.toLowerCase()} domain specialist, security lead, and delivery manager. Named CVs are attached.`,

    Pricing: useMemory
      ? `Pricing is broken down by phase and by deliverable, with the assumptions behind every line item stated. ${losses.length ? "We are explicit here because generic pricing language cost us a comparable bid." : ""} A payback model accompanies the total.`
      : `Total programme cost is presented as a single fixed fee, with optional support packages available.`,

    "ROI / Business Value": useMemory
      ? `Value is quantified: projected efficiency gain, risk reduction and payback period, each traceable to a measurable baseline agreed with ${clientName} during discovery.`
      : `The solution is expected to improve efficiency and reduce operational overhead.`,

    Conclusion: useMemory
      ? `${recommendation.strategy}`
      : `We would welcome the opportunity to work with ${clientName} on this programme.`,
  };

  const memoryHeavy = new Set<SectionTitle>([
    "Executive Summary",
    "Security & Compliance",
    "Implementation Plan",
    "Pricing",
    "ROI / Business Value",
    "Conclusion",
  ]);

  return SECTION_TITLES.map((title) => ({
    id: slug(title),
    title,
    content: body[title],
    informedBy:
      useMemory && memoryHeavy.has(title)
        ? (title === "Pricing" ? losses : wins)
            .map((m) => m.id)
            .concat(memoryIds)
            .slice(0, 3)
        : [],
  }));
}

export type RefineAction = "regenerate" | "improve" | "shorter" | "persuasive" | "detail";

export async function refineSection(
  sectionTitle: string,
  content: string,
  action: RefineAction,
  instruction?: string,
): Promise<string> {
  if (getLLMConfig()) {
    try {
      const prompt = `Refine the following section of a business proposal.
Section Title: ${sectionTitle}
Action: ${action}
${instruction ? `User Specific Instruction: ${instruction}` : ""}

Current Content:
${content}

Return ONLY the refined content text with no conversational wrapper.`;
      return await callLLM(prompt, "You are an expert executive proposal editor.");
    } catch (err) {
      console.warn("LLM refine section failed:", err);
    }
  }

  // Fallback heuristic refinement
  if (action === "shorter") {
    return content.split("\n").slice(0, 3).join("\n");
  } else if (action === "persuasive") {
    return `[Enhanced Persuasiveness]\n${content}\n\nKey Advantage: Proven risk reduction and immediate return on investment.`;
  } else if (action === "detail") {
    return `${content}\n\nImplementation Detail: Includes full verification metrics, automated test gates, and dedicated SLA support.`;
  }
  return content;
}
