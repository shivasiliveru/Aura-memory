import React, { useState } from "react";
import {
  Brain,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  ShieldCheck,
  Zap,
  Loader2,
  Database,
  Building,
  Calendar,
  Layers,
  HelpCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import type {
  AgentRecommendation,
  Industry,
  MemoryProviderStatus,
  ProposalSection,
  RFPAnalysis,
  RecalledMemory,
} from "@/types";

interface NewRFPWizardProps {
  onProposalCreated: (proposalId: string) => void;
  memoryStatus: MemoryProviderStatus | null;
}

const SAMPLE_RFPS = [
  {
    title: "Healthcare Patient Portal & EHR Integration",
    clientName: "St. Jude Health System",
    industry: "Healthcare" as Industry,
    deadline: "2026-11-15",
    value: 650000,
    content: `St. Jude Health System requests proposals for a next-generation Patient Portal and EHR Integration platform.
Key Requirements:
- Patient scheduling, tele-consultation, and lab result visualization.
- Complete HIPAA compliance, SOC 2 Type II certification, and end-to-end data encryption at rest and in transit.
- Integration with Epic and Cerner EHR platforms via HL7 / FHIR APIs.
- Comprehensive security architecture documentation with zero-trust network access controls.
- Phased deployment across 12 regional facilities with a 16-week timeline.
- Detailed implementation roadmap with named workstream owners.
Evaluation criteria: Technical architecture depth, compliance rigor, team expertise, pricing transparency, and ROI justification.`,
  },
  {
    title: "Core Banking Risk Analytics & Compliance Platform",
    clientName: "Pacific National Bank",
    industry: "Banking" as Industry,
    deadline: "2026-12-01",
    value: 850000,
    content: `Pacific National Bank is issuing an RFP for a Core Banking Risk Analytics Platform.
Stated Scope:
- Real-time transaction monitoring, fraud risk scoring, and anti-money laundering (AML) compliance reporting.
- High-availability cloud infrastructure with 99.99% uptime SLA and under 50ms latency.
- Direct API integration with Fiserv core banking ledger and audit trail logging.
- Clear quantification of financial risk reduction and payback period.
- Regulatory alignment with Federal Reserve and OCC compliance mandates.
Evaluation criteria: Quantified ROI, technical integration depth, regulatory audit controls, and fixed deliverable pricing.`,
  },
  {
    title: "SaaS Multi-Cloud Infrastructure Observability",
    clientName: "Apex Cloud Technologies",
    industry: "SaaS" as Industry,
    deadline: "2026-10-30",
    value: 420000,
    content: `Apex Cloud Technologies is soliciting proposals for a unified multi-cloud infrastructure observability and incident remediation suite.
Requirements:
- OpenTelemetry log, trace, and metric ingestion at enterprise scale.
- Zero-downtime migration architecture with automated rollback safety mechanisms.
- SOC 2 compliance and role-based access control (RBAC).
- Technical approach must include detailed architecture diagrams and named engineering specialists.
Evaluation criteria: Engineering technical depth, zero-downtime migration strategy, rollback reliability, and SLA guarantees.`,
  },
];

export function NewRFPWizard({ onProposalCreated, memoryStatus }: NewRFPWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Form inputs
  const [title, setTitle] = useState("");
  const [clientName, setClientName] = useState("");
  const [industry, setIndustry] = useState<Industry>("Healthcare");
  const [deadline, setDeadline] = useState("");
  const [estimatedValue, setEstimatedValue] = useState<number>(500000);
  const [content, setContent] = useState("");
  const [useMemory, setUseMemory] = useState(true);

  // Analysis & Recall state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<RFPAnalysis | null>(null);
  const [recalledMemories, setRecalledMemories] = useState<RecalledMemory[]>([]);
  const [recommendation, setRecommendation] = useState<AgentRecommendation | null>(null);

  // Generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSections, setGeneratedSections] = useState<ProposalSection[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const loadSample = (sample: (typeof SAMPLE_RFPS)[0]) => {
    setTitle(sample.title);
    setClientName(sample.clientName);
    setIndustry(sample.industry);
    setDeadline(sample.deadline);
    setEstimatedValue(sample.value);
    setContent(sample.content);
    setErrorMsg("");
  };

  // Handle Step 1 -> Step 2 (Analyze RFP & Recall Hindsight)
  const handleAnalyzeAndRecall = async () => {
    if (!title || !clientName || !content || content.length < 20) {
      setErrorMsg("Please provide a title, client name, and RFP text (at least 20 characters).");
      return;
    }
    setErrorMsg("");
    setIsAnalyzing(true);

    try {
      const res = await fetch("/api/rfp/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          clientName,
          industry,
          deadline,
          estimatedValue,
          content,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Analysis failed with status ${res.status}`);
      }

      const data = await res.json();
      setAnalysis(data.analysis);
      setRecalledMemories(data.recalled || []);
      setRecommendation(data.recommendation);
      setStep(2);
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to analyze RFP.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Handle Step 2 -> Step 3 (Generate AI Proposal)
  const handleGenerateProposal = async () => {
    if (!analysis || !recommendation) return;
    setIsGenerating(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/proposals/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          clientName,
          industry,
          content,
          deadline,
          useMemory,
          analysis,
          recommendation: useMemory
            ? recommendation
            : { ...recommendation, basedOn: [], successfulPatterns: [], warnings: [] },
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || `Generation failed with status ${res.status}`);
      }

      const data = await res.json();
      setGeneratedSections(data.sections || []);
      if (data.recommendation) setRecommendation(data.recommendation);
      setStep(3);
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to generate proposal.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Save Proposal to Store & trigger parent callback
  const handleSaveAndOpen = async () => {
    try {
      const res = await fetch("/api/proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          clientName,
          industry,
          value: estimatedValue,
          rfpContent: content,
          sections: generatedSections,
          strategy: recommendation?.strategy || "",
          recommendationMemoryIds: useMemory ? recalledMemories.map((m) => m.id) : [],
          analysis,
          ...(recommendation
            ? {
                recommendation: useMemory
                  ? recommendation
                  : { ...recommendation, basedOn: [], reasoning: [], source: "none" },
              }
            : {}),
        }),
      });

      if (!res.ok) throw new Error("Failed to save proposal");
      const data = await res.json();
      onProposalCreated(data.proposal.id);
    } catch (err) {
      console.error(err);
      setErrorMsg("Could not save proposal.");
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Wizard Progress Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-amber-500" /> New RFP AI Agent Workflow
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Step {step} of 3:{" "}
            {step === 1
              ? "Paste RFP & Details"
              : step === 2
                ? "RFP Analysis & Hindsight Memory Recall"
                : "AI Proposal Generation & Strategy"}
          </p>
        </div>

        {/* Step Indicator Badges */}
        <div className="flex items-center gap-2">
          <Badge
            variant={step === 1 ? "default" : "secondary"}
            className="gap-1.5 px-3 py-1 text-xs"
          >
            1. RFP Input
          </Badge>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <Badge
            variant={step === 2 ? "default" : "secondary"}
            className="gap-1.5 px-3 py-1 text-xs"
          >
            2. Memory Recall
          </Badge>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <Badge
            variant={step === 3 ? "default" : "secondary"}
            className="gap-1.5 px-3 py-1 text-xs"
          >
            3. AI Proposal
          </Badge>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* STEP 1: RFP INPUT */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form (2 cols) */}
          <Card className="lg:col-span-2 border-border/60 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">Request for Proposal (RFP) Input</CardTitle>
              <CardDescription className="text-xs">
                Enter client requirements, scope, or paste the RFP document text below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="rfp-title" className="text-xs font-semibold">
                    Proposal Title *
                  </Label>
                  <Input
                    id="rfp-title"
                    placeholder="e.g. Healthcare EHR Patient Portal"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="client-name" className="text-xs font-semibold">
                    Client Name *
                  </Label>
                  <Input
                    id="client-name"
                    placeholder="e.g. St. Jude Health System"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="industry-select" className="text-xs font-semibold">
                    Industry *
                  </Label>
                  <Select value={industry} onValueChange={(v) => setIndustry(v as Industry)}>
                    <SelectTrigger id="industry-select">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Healthcare">Healthcare</SelectItem>
                      <SelectItem value="Banking">Banking</SelectItem>
                      <SelectItem value="FinTech">FinTech</SelectItem>
                      <SelectItem value="SaaS">SaaS</SelectItem>
                      <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                      <SelectItem value="Technology">Technology</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="deadline-input" className="text-xs font-semibold">
                    Submission Deadline
                  </Label>
                  <Input
                    id="deadline-input"
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="value-input" className="text-xs font-semibold">
                    Estimated Value ($)
                  </Label>
                  <Input
                    id="value-input"
                    type="number"
                    value={estimatedValue}
                    onChange={(e) => setEstimatedValue(Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rfp-content" className="text-xs font-semibold">
                  Pasted RFP Text Content *
                </Label>
                <Textarea
                  id="rfp-content"
                  rows={8}
                  placeholder="Paste the full RFP document text, scope of work, technical requirements, or compliance guidelines..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="font-mono text-xs leading-relaxed"
                />
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  onClick={handleAnalyzeAndRecall}
                  disabled={isAnalyzing}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 shadow-md"
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Analyzing RFP & Recalling
                      Hindsight...
                    </>
                  ) : (
                    <>
                      Analyze RFP & Recall Experience <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Quick Demo Loader Cards (1 col) */}
          <div className="space-y-4">
            <Card className="border-border/60 bg-gradient-to-b from-indigo-50/50 to-background dark:from-indigo-950/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Zap className="h-4 w-4 text-amber-500" /> Load Sample RFPs
                </CardTitle>
                <CardDescription className="text-xs">
                  Test the memory recall loop instantly using realistic RFP templates.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {SAMPLE_RFPS.map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => loadSample(sample)}
                    className="w-full text-left p-3 rounded-lg border border-border/60 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all space-y-1 group"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-foreground group-hover:text-indigo-600">
                      <span>{sample.clientName}</span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {sample.industry}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-1">{sample.title}</p>
                  </button>
                ))}
              </CardContent>
            </Card>

            <Card className="border-border/60 text-xs">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold flex items-center gap-1.5">
                  <Brain className="h-3.5 w-3.5 text-purple-500" /> Hindsight Memory Loop
                </CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-2 leading-normal">
                <p>
                  When you submit an RFP, the system queries Hindsight long-term memory for previous
                  proposals with similar industry, technical, or compliance requirements.
                </p>
                <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">
                  ✓ Recalled experiences guide AI proposal generation strategies.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* STEP 2: RFP ANALYSIS & HINDSIGHT RECALL */}
      {step === 2 && analysis && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* RFP Extracted Analysis Card */}
            <Card className="border-border/60 shadow-sm">
              <CardHeader className="border-b border-border/40 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4 text-blue-500" /> Extracted RFP Intelligence
                  </CardTitle>
                  <Badge variant="outline" className="text-xs">
                    {analysis.industry}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Structured requirements extracted from {analysis.client}'s RFP.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-4 text-xs">
                <div>
                  <h4 className="font-semibold text-foreground mb-1">Key Requirements</h4>
                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                    {analysis.keyRequirements.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground mb-1">Technical Requirements</h4>
                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                    {analysis.technicalRequirements.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="font-semibold text-foreground mb-1">
                    Compliance & Security Controls
                  </h4>
                  <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                    {analysis.complianceRequirements.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>

                <div className="pt-2 border-t border-border/40 flex items-center justify-between text-muted-foreground">
                  <span>
                    Timeline: <strong className="text-foreground">{analysis.timeline}</strong>
                  </span>
                  <span>
                    Keywords:{" "}
                    <span className="font-mono">{analysis.keywords.slice(0, 3).join(", ")}</span>
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Hindsight Recalled Memories Card */}
            <Card className="border-purple-500/30 shadow-sm bg-gradient-to-b from-purple-50/20 to-background dark:from-purple-950/10">
              <CardHeader className="border-b border-purple-500/20 pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2 text-purple-700 dark:text-purple-300">
                    <Brain className="h-4 w-4 text-purple-500" /> Hindsight Memory Recall (
                    {recalledMemories.length})
                  </CardTitle>
                  <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-400/30 text-xs">
                    RECALL Active
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  Previous business experiences retrieved from Hindsight relevant to this RFP.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-3.5 text-xs">
                {recalledMemories.length === 0 ? (
                  <p className="text-muted-foreground italic">
                    No prior memories matched this RFP query.
                  </p>
                ) : (
                  recalledMemories.map((mem) => (
                    <div
                      key={mem.id}
                      className="p-3 rounded-lg border border-purple-500/20 bg-background/80 space-y-1.5 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground text-xs">{mem.title}</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-purple-600 font-mono font-medium">
                            {Math.round(mem.relevance * 100)}% match
                          </span>
                          <Badge
                            className={
                              mem.outcome === "won"
                                ? "bg-emerald-500/15 text-emerald-700 text-[10px]"
                                : "bg-rose-500/15 text-rose-700 text-[10px]"
                            }
                          >
                            {mem.outcome.toUpperCase()}
                          </Badge>
                        </div>
                      </div>

                      <p className="text-muted-foreground text-[11px] leading-normal">
                        {mem.content}
                      </p>

                      {mem.lessons.length > 0 && (
                        <div className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                          💡 Lesson: {mem.lessons[0]}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1 pt-1">
                        {mem.relevanceReasons.map((reason, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-accent px-1.5 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Strategy Recommendation Banner */}
          {recommendation && (
            <Card className="border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-500" /> Hindsight Agent Strategy
                  Recommendation
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs text-foreground space-y-2">
                <p className="font-medium leading-relaxed">{recommendation.strategy}</p>

                {recommendation.reasoning.length > 0 && (
                  <div className="space-y-1 pt-1">
                    <span className="font-semibold text-indigo-700 dark:text-indigo-300 text-[11px] uppercase tracking-wider">
                      Why this proposal?
                    </span>
                    <ul className="list-disc pl-4 space-y-0.5 text-muted-foreground">
                      {recommendation.reasoning.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">
                  {recommendation.source === "hindsight-reflect"
                    ? "Synthesised by Hindsight reflect from recalled experiences."
                    : recommendation.source === "llm"
                      ? "Synthesised by the LLM from experiences recalled via Hindsight."
                      : recommendation.summary}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {recommendation.successfulPatterns.length > 0 && (
                    <div className="space-y-1">
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-[11px] uppercase tracking-wider">
                        ✓ Positive Factors to Emphasize
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {recommendation.successfulPatterns.map((p, i) => (
                          <Badge key={i} className="bg-emerald-500/15 text-emerald-700 text-[11px]">
                            {p}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {recommendation.warnings.length > 0 && (
                    <div className="space-y-1">
                      <span className="font-semibold text-rose-600 dark:text-rose-400 text-[11px] uppercase tracking-wider">
                        ⚠ Pitfalls to Avoid
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {recommendation.warnings.map((w, i) => (
                          <Badge key={i} className="bg-rose-500/15 text-rose-700 text-[11px]">
                            {w}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Toggle & Action Buttons */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-border/60">
            <div className="flex items-center gap-3">
              <Switch id="memory-toggle" checked={useMemory} onCheckedChange={setUseMemory} />
              <Label htmlFor="memory-toggle" className="text-xs cursor-pointer">
                Infuse Recalled Hindsight Memories into AI Generation
                <span className="block text-[11px] text-muted-foreground font-normal">
                  {useMemory
                    ? "Active: RFP + Memories -> Tailored Strategy"
                    : "Inactive: Baseline generic proposal"}
                </span>
              </Label>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setStep(1)} className="gap-1">
                <ArrowLeft className="h-4 w-4" /> Back to Edit RFP
              </Button>
              <Button
                onClick={handleGenerateProposal}
                disabled={isGenerating}
                className="bg-indigo-600 hover:bg-indigo-500 text-white gap-2 shadow-md"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating AI Proposal...
                  </>
                ) : (
                  <>
                    Generate Proposal <Sparkles className="h-4 w-4 text-amber-300" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: GENERATED PROPOSAL PREVIEW & SAVE */}
      {step === 3 && (
        <div className="space-y-6">
          {/* Agent Strategy & Citation Summary */}
          <Card className="border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-950/20">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-indigo-700 dark:text-indigo-300 flex items-center gap-2">
                  <Brain className="h-5 w-5 text-indigo-500" /> Why the Agent Recommended This
                  Strategy
                </CardTitle>
                <Badge variant="outline" className="border-indigo-400 text-xs">
                  {useMemory ? `${recalledMemories.length} Memories Recalled` : "Baseline Standard"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="text-xs space-y-2 text-foreground">
              <p className="font-medium leading-relaxed">{recommendation?.strategy}</p>

              {useMemory && recalledMemories.length > 0 && (
                <div className="pt-2 border-t border-indigo-200/50 dark:border-indigo-900/50 space-y-1">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    Informed by previous experiences:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {recalledMemories.map((m) => (
                      <Badge key={m.id} variant="secondary" className="text-[10px]">
                        {m.title} ({m.outcome.toUpperCase()})
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Generated Proposal Sections Preview */}
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="border-b border-border/40 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription className="text-xs">
                  Generated {generatedSections.length} Proposal Sections · Client: {clientName} (
                  {industry})
                </CardDescription>
              </div>
              <Button
                onClick={handleSaveAndOpen}
                className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shadow-md"
              >
                <CheckCircle2 className="h-4 w-4" /> Save & Open Interactive Editor
              </Button>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {generatedSections.map((sec, idx) => (
                <div
                  key={sec.id || idx}
                  className="space-y-1.5 border-b border-border/40 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                      <span className="text-muted-foreground font-normal">{idx + 1}.</span>{" "}
                      {sec.title}
                    </h3>
                    {sec.informedBy.length > 0 && (
                      <Badge
                        variant="outline"
                        className="border-purple-300 text-purple-700 dark:text-purple-300 text-[10px]"
                      >
                        <Brain className="h-3 w-3 mr-1" /> Informed by {sec.informedBy.length}{" "}
                        memories
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-sans">
                    {sec.content}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Bottom Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-border/60">
            <Button variant="outline" size="sm" onClick={() => setStep(2)} className="gap-1">
              <ArrowLeft className="h-4 w-4" /> Back to Recall Review
            </Button>
            <Button
              onClick={handleSaveAndOpen}
              className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shadow-md"
            >
              <CheckCircle2 className="h-4 w-4" /> Save & Open Interactive Editor
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
