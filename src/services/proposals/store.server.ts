import type { Client, Memory, Proposal, ProposalOutcome } from "@/types";

/**
 * In-memory demo store for the Demo Workspace.
 *
 * This is deliberately a simple process-level store: the project is meant to be
 * exported and wired to a real database + Hindsight after the hackathon.
 * Nothing here pretends to be long-term agent memory — see
 * `src/services/hindsight/`.
 */

const iso = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString();

export const clients: Client[] = [
  {
    id: "c-abc-health",
    name: "ABC Healthcare",
    industry: "Healthcare",
    preferences: ["Security-focused", "Compliance-focused", "Detailed implementation plans"],
    importantRequirements: ["HIPAA compliance", "SOC 2 Type II", "24-month roadmap"],
    learnedPatterns: [
      "Responds well to named security architecture diagrams",
      "Wants compliance addressed in the first three pages",
    ],
  },
  {
    id: "c-northbay",
    name: "Northbay Medical Group",
    industry: "Healthcare",
    preferences: ["Clinical workflow detail", "Phased rollout"],
    importantRequirements: ["EHR integration", "Clinician training plan"],
    learnedPatterns: ["Pricing must be broken down per facility"],
  },
  {
    id: "c-meridian",
    name: "Meridian Bank",
    industry: "Banking",
    preferences: ["Risk reduction", "Regulatory alignment"],
    importantRequirements: ["Core banking integration", "Audit trail"],
    learnedPatterns: ["Quantified risk reduction beats feature lists"],
  },
  {
    id: "c-halcyon",
    name: "Halcyon Payments",
    industry: "FinTech",
    preferences: ["ROI-focused messaging", "Fast time-to-value"],
    importantRequirements: ["PCI DSS", "Latency SLAs"],
    learnedPatterns: ["Expects a payback-period figure in the summary"],
  },
  {
    id: "c-lumen",
    name: "Lumen Cloud",
    industry: "SaaS",
    preferences: ["Technical depth", "Migration safety"],
    importantRequirements: ["Zero-downtime migration", "API coverage"],
    learnedPatterns: ["Technical reviewers score architecture sections heaviest"],
  },
  {
    id: "c-forge",
    name: "Forge Industrial",
    industry: "Manufacturing",
    preferences: ["Uptime guarantees", "On-site support"],
    importantRequirements: ["OT/IT convergence", "Plant-floor rollout plan"],
    learnedPatterns: ["Downtime cost modelling drives decisions"],
  },
];

export const proposals: Proposal[] = [
  seed("p-1", "ABC Healthcare Patient Platform", "c-abc-health", "Healthcare", "won", 480_000, 210),
  seed("p-2", "Northbay EHR Modernization", "c-northbay", "Healthcare", "lost", 320_000, 175),
  seed("p-3", "Northbay Telehealth Expansion", "c-northbay", "Healthcare", "won", 260_000, 120),
  seed("p-4", "Meridian Bank Risk Platform", "c-meridian", "Banking", "won", 910_000, 150),
  seed("p-5", "Meridian Core Integration", "c-meridian", "Banking", "lost", 540_000, 96),
  seed("p-6", "Halcyon Payments Orchestration", "c-halcyon", "FinTech", "won", 375_000, 78),
  seed("p-7", "Halcyon Fraud Analytics", "c-halcyon", "FinTech", "lost", 210_000, 64),
  seed("p-8", "Lumen Cloud Migration Program", "c-lumen", "SaaS", "won", 620_000, 45),
  seed("p-9", "Forge Industrial IoT Rollout", "c-forge", "Manufacturing", "pending", 700_000, 18),
  seed("p-10", "Lumen Platform Observability", "c-lumen", "SaaS", "pending", 180_000, 9),
];

function seed(
  id: string,
  title: string,
  clientId: string,
  industry: Proposal["industry"],
  status: Proposal["status"],
  value: number,
  daysAgo: number,
): Proposal {
  const client = clients.find((c) => c.id === clientId)!;
  return {
    id,
    title,
    clientId,
    clientName: client.name,
    industry,
    status,
    value,
    rfpContent: `${title} — request for proposal issued by ${client.name}.`,
    sections: [],
    recommendationMemoryIds: [],
    createdAt: iso(daysAgo),
    updatedAt: iso(Math.max(0, daysAgo - 5)),
  };
}

export const outcomes: ProposalOutcome[] = [];

export const memories: Memory[] = [
  {
    id: "m-1",
    title: "ABC Healthcare Patient Platform — Won",
    sourceProposalId: "p-1",
    industry: "Healthcare",
    outcome: "won",
    clientType: "Hospital network",
    content:
      "A detailed security architecture and an early compliance chapter moved the evaluation committee. The implementation timeline named owners and dates per phase.",
    lessons: [
      "Detailed security architecture increased confidence.",
      "Compliance requirements should be addressed early.",
      "Implementation timeline should be specific.",
    ],
    successfulPatterns: ["Security detail", "Compliance", "Implementation plan", "Timeline"],
    failedPatterns: [],
    createdAt: iso(200),
  },
  {
    id: "m-2",
    title: "Northbay EHR Modernization — Lost",
    sourceProposalId: "p-2",
    industry: "Healthcare",
    outcome: "lost",
    clientType: "Regional medical group",
    content:
      "The pricing chapter used boilerplate language and the ROI was never quantified. Debrief confirmed price clarity was the deciding factor.",
    lessons: ["Pricing explanation was too generic.", "ROI was not clearly quantified."],
    successfulPatterns: [],
    failedPatterns: ["Generic pricing", "Weak ROI"],
    createdAt: iso(168),
  },
  {
    id: "m-3",
    title: "Northbay Telehealth Expansion — Won",
    sourceProposalId: "p-3",
    industry: "Healthcare",
    outcome: "won",
    clientType: "Regional medical group",
    content:
      "Rewrote pricing as a per-facility breakdown with a payback period. Clinical workflow mapping was added after the previous loss.",
    lessons: [
      "Per-facility pricing breakdown resolved the earlier objection.",
      "Workflow mapping proved we understood clinical reality.",
    ],
    successfulPatterns: ["Pricing", "Customization", "Compliance"],
    failedPatterns: [],
    createdAt: iso(112),
  },
  {
    id: "m-4",
    title: "Meridian Bank Risk Platform — Won",
    sourceProposalId: "p-4",
    industry: "Banking",
    outcome: "won",
    clientType: "Tier 2 bank",
    content:
      "Risk reduction was quantified in basis points and the integration plan covered core banking systems by name.",
    lessons: ["Risk reduction emphasized.", "Detailed integration plan won technical scoring."],
    successfulPatterns: ["ROI", "Technical detail", "Implementation plan"],
    failedPatterns: [],
    createdAt: iso(145),
  },
  {
    id: "m-5",
    title: "Meridian Core Integration — Lost",
    sourceProposalId: "p-5",
    industry: "Banking",
    outcome: "lost",
    clientType: "Tier 2 bank",
    content:
      "Technical approach stayed at a conceptual level and the audit trail requirement was answered in one paragraph.",
    lessons: [
      "Insufficient technical detail on integration.",
      "Compliance evidence must be explicit, not implied.",
    ],
    successfulPatterns: [],
    failedPatterns: ["Insufficient technical detail", "Generic messaging"],
    createdAt: iso(90),
  },
  {
    id: "m-6",
    title: "Halcyon Payments Orchestration — Won",
    sourceProposalId: "p-6",
    industry: "FinTech",
    outcome: "won",
    clientType: "Payments provider",
    content:
      "Led with a payback-period model and measurable transaction-cost savings. PCI scope was mapped explicitly.",
    lessons: ["ROI-focused messaging wins in FinTech.", "Map compliance scope explicitly."],
    successfulPatterns: ["ROI", "Compliance", "Pricing"],
    failedPatterns: [],
    createdAt: iso(74),
  },
  {
    id: "m-7",
    title: "Halcyon Fraud Analytics — Lost",
    sourceProposalId: "p-7",
    industry: "FinTech",
    outcome: "lost",
    clientType: "Payments provider",
    content:
      "Messaging was reused from a generic template; the model accuracy claims lacked evidence.",
    lessons: ["Generic messaging lost to a specialist competitor.", "Claims need evidence."],
    successfulPatterns: [],
    failedPatterns: ["Generic messaging", "Weak ROI"],
    createdAt: iso(60),
  },
  {
    id: "m-8",
    title: "Lumen Cloud Migration Program — Won",
    sourceProposalId: "p-8",
    industry: "SaaS",
    outcome: "won",
    clientType: "Cloud platform vendor",
    content:
      "Zero-downtime cutover design and a rollback plan for each wave carried the technical score.",
    lessons: ["Technical depth is the deciding factor with engineering buyers.", "Always include rollback plans."],
    successfulPatterns: ["Technical detail", "Implementation plan", "Timeline"],
    failedPatterns: [],
    createdAt: iso(42),
  },
  {
    id: "m-9",
    title: "Forge Industrial IoT Rollout — Pending",
    sourceProposalId: "p-9",
    industry: "Manufacturing",
    outcome: "pending",
    clientType: "Industrial manufacturer",
    content:
      "Downtime cost modelling was included per plant. Awaiting the evaluation committee decision.",
    lessons: ["Downtime cost modelling resonated in early feedback."],
    successfulPatterns: ["ROI", "Customization"],
    failedPatterns: [],
    createdAt: iso(16),
  },
  {
    id: "m-10",
    title: "ABC Healthcare Security Addendum — Won",
    sourceProposalId: "p-1",
    industry: "Healthcare",
    outcome: "won",
    clientType: "Hospital network",
    content:
      "A follow-up addendum with data-privacy controls and a named security lead closed the final objection.",
    lessons: ["Name the security lead.", "Data privacy controls deserve their own section."],
    successfulPatterns: ["Security detail", "Compliance"],
    failedPatterns: [],
    createdAt: iso(190),
  },
];

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
