export type Outcome = "won" | "lost" | "pending";
export type ProposalStatus = "draft" | "pending" | "won" | "lost";
export type Industry =
  "Healthcare" | "Banking" | "FinTech" | "SaaS" | "Manufacturing" | "Technology" | "Other";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Workspace {
  id: string;
  name: string;
  company: string;
  memoryProvider: "hindsight";
  memoryConnected: boolean;
}

export interface Client {
  id: string;
  name: string;
  industry: Industry;
  preferences: string[];
  importantRequirements: string[];
  learnedPatterns: string[];
}

export interface RFP {
  id: string;
  title: string;
  clientName: string;
  industry: Industry;
  deadline?: string;
  estimatedValue?: number;
  content: string;
}

export interface RFPAnalysis {
  client: string;
  industry: Industry;
  keyRequirements: string[];
  technicalRequirements: string[];
  complianceRequirements: string[];
  timeline: string;
  evaluationCriteria: string[];
  keywords: string[];
}

export interface ProposalSection {
  id: string;
  title: string;
  content: string;
  /** Ids of memories that shaped this section. */
  informedBy: string[];
}

export interface Proposal {
  id: string;
  title: string;
  clientId: string;
  clientName: string;
  industry: Industry;
  status: ProposalStatus;
  rfpContent: string;
  sections: ProposalSection[];
  value: number;
  strategy?: string;
  recommendationMemoryIds: string[];
  /** RFP analysis the proposal was generated from. */
  analysis?: RFPAnalysis;
  /** Snapshot of what Hindsight recalled/reflected at generation time — backs "Why this proposal?". */
  recommendation?: AgentRecommendation;
  createdAt: string;
  updatedAt: string;
}

export interface ProposalOutcome {
  proposalId: string;
  status: Outcome;
  successfulFactors: string[];
  failureFactors: string[];
  lessons: string;
  recordedAt: string;
}

export interface Memory {
  id: string;
  title: string;
  sourceProposalId: string;
  industry: Industry;
  outcome: Outcome;
  clientType: string;
  content: string;
  lessons: string[];
  successfulPatterns: string[];
  failedPatterns: string[];
  /** Short description of the RFP this experience came from. */
  rfpContext?: string;
  /** Strategy the proposal followed. */
  strategy?: string;
  clientPreferences?: string[];
  /** Concrete instructions for the next similar proposal. */
  recommendations?: string[];
  /** Whether lessons were structured by the LLM or taken as the user entered them. */
  extractedBy?: "llm" | "user";
  createdAt: string;
}

export interface RecalledMemory extends Memory {
  relevance: number;
  relevanceReasons: string[];
  /** Hindsight fact ids this experience was assembled from. */
  factIds?: string[];
}

export interface AgentRecommendation {
  summary: string;
  strategy: string;
  successfulPatterns: string[];
  warnings: string[];
  /** "Why this proposal" bullets, each tied to a recalled past proposal. */
  reasoning: string[];
  /** What produced the strategy: Hindsight reflect, the LLM over recalled memories, or neither. */
  source: "hindsight-reflect" | "llm" | "none";
  basedOn: RecalledMemory[];
}

export interface Insight {
  id: string;
  label: string;
  detail: string;
  tone: "positive" | "negative" | "neutral";
  occurrences: number;
}

export interface InsightsPayload {
  winRateByIndustry: { industry: string; won: number; lost: number; winRate: number }[];
  successPatterns: { pattern: string; count: number }[];
  failurePatterns: { pattern: string; count: number }[];
  insights: Insight[];
}

export interface MemoryProviderStatus {
  provider: "hindsight";
  connected: boolean;
  mode: "live" | "not-configured" | "unreachable";
  message: string;
}
