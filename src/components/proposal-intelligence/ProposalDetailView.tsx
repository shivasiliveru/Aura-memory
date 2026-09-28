import React, { useState } from "react";
import {
  Brain,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Edit3,
  Save,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Wand2,
  Database,
  Layers,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OutcomeModal } from "./OutcomeModal";
import type { Memory, Outcome, Proposal, ProposalSection, RecalledMemory } from "@/types";

interface ProposalDetailViewProps {
  proposal: Proposal;
  recalledMemories: RecalledMemory[];
  onBack: () => void;
  onProposalUpdated: (updated: Proposal) => void;
}

export function ProposalDetailView({
  proposal,
  recalledMemories,
  onBack,
  onProposalUpdated,
}: ProposalDetailViewProps) {
  const [sections, setSections] = useState<ProposalSection[]>(proposal.sections || []);
  const [activeSectionId, setActiveSectionId] = useState<string>(
    sections[0]?.id || "executive-summary",
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isOutcomeModalOpen, setIsOutcomeModalOpen] = useState(false);
  const [isRefining, setIsRefining] = useState(false);

  const rec = proposal.recommendation;
  const currentSection = sections.find((s) => s.id === activeSectionId) || sections[0];

  const handleContentChange = (newContent: string) => {
    if (!currentSection) return;
    setSections((prev) =>
      prev.map((s) => (s.id === currentSection.id ? { ...s, content: newContent } : s)),
    );
  };

  const handleSaveSections = async () => {
    try {
      const res = await fetch(`/api/proposals/${proposal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sections }),
      });
      if (res.ok) {
        const data = await res.json();
        onProposalUpdated(data.proposal);
        setIsEditing(false);
      }
    } catch (err) {
      console.error("Failed to save proposal sections:", err);
    }
  };

  const handleRefineSection = async (action: "shorter" | "persuasive" | "detail") => {
    if (!currentSection) return;
    setIsRefining(true);
    try {
      const res = await fetch("/api/proposals/refine-section", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionTitle: currentSection.title,
          content: currentSection.content,
          action,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.content) handleContentChange(data.content);
      } else {
        // graceful heuristic fallback
        let refined = currentSection.content;
        if (action === "shorter")
          refined = currentSection.content.split("\n").slice(0, 3).join("\n");
        else if (action === "persuasive")
          refined = `${currentSection.content}\n\n[Persuasive Edge]: Quantified payback model and guaranteed compliance SLA.`;
        else if (action === "detail")
          refined = `${currentSection.content}\n\n[Implementation Detail]: Includes step-by-step verification, rollback safety gates, and named security leads.`;
        handleContentChange(refined);
      }
    } catch {
      // network error fallback
      let refined = currentSection.content;
      if (action === "shorter") refined = currentSection.content.split("\n").slice(0, 3).join("\n");
      handleContentChange(refined);
    } finally {
      setIsRefining(false);
    }
  };

  const handleOutcomeSaved = (proposalId: string, outcome: Outcome, memory: Memory) => {
    onProposalUpdated({
      ...proposal,
      status: outcome,
    });
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 p-1 h-auto">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <h1 className="text-xl font-bold text-foreground">{proposal.title}</h1>
            <Badge variant="outline" className="text-xs">
              {proposal.industry}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Client: <span className="font-semibold text-foreground">{proposal.clientName}</span> ·
            Estimated Value: ${proposal.value.toLocaleString()}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          {proposal.status === "won" && (
            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 gap-1 text-xs py-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> WON
            </Badge>
          )}
          {proposal.status === "lost" && (
            <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 gap-1 text-xs py-1">
              <XCircle className="h-3.5 w-3.5" /> LOST
            </Badge>
          )}
          {(proposal.status === "pending" || proposal.status === "draft") && (
            <Badge variant="secondary" className="gap-1 text-xs py-1">
              <Clock className="h-3.5 w-3.5" /> PENDING EVALUATION
            </Badge>
          )}

          <Button
            onClick={() => setIsOutcomeModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-500 text-white gap-2 shadow-sm text-xs"
          >
            <Database className="h-3.5 w-3.5" /> Record Outcome / Retain Memory
          </Button>
        </div>
      </div>

      {/* Main Grid Layout (2/3 Editor, 1/3 Intelligence Sidebar) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Proposal Sections & Tabs */}
        <div className="lg:col-span-2 space-y-4">
          <Tabs defaultValue="editor" className="w-full">
            <TabsList className="grid grid-cols-2 w-full max-w-xs">
              <TabsTrigger value="editor" className="text-xs">
                Proposal Editor
              </TabsTrigger>
              <TabsTrigger value="rfp" className="text-xs">
                Original RFP Text
              </TabsTrigger>
            </TabsList>

            <TabsContent value="editor" className="mt-4 space-y-4">
              <Card className="border-border/60 shadow-sm">
                <CardHeader className="pb-3 border-b border-border/40">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <FileText className="h-4 w-4 text-blue-500" /> Interactive Section Editor
                    </CardTitle>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <Button
                          size="sm"
                          onClick={handleSaveSections}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 text-xs"
                        >
                          <Save className="h-3.5 w-3.5" /> Save Changes
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditing(true)}
                          className="gap-1.5 text-xs"
                        >
                          <Edit3 className="h-3.5 w-3.5" /> Edit Section
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-4">
                  {/* Section Selector Pills */}
                  <div className="flex flex-wrap gap-1.5 border-b border-border/40 pb-3">
                    {sections.map((sec) => (
                      <button
                        key={sec.id}
                        onClick={() => setActiveSectionId(sec.id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                          sec.id === currentSection?.id
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-accent/50 text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {sec.title}
                      </button>
                    ))}
                  </div>

                  {/* Active Section Header & Informed By */}
                  {currentSection && (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                          {currentSection.title}
                        </h3>

                        {/* Refine Tools */}
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isRefining}
                            onClick={() => handleRefineSection("shorter")}
                            className="text-[11px] h-7 px-2 text-muted-foreground"
                          >
                            Concise
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isRefining}
                            onClick={() => handleRefineSection("persuasive")}
                            className="text-[11px] h-7 px-2 text-muted-foreground"
                          >
                            Persuasive
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={isRefining}
                            onClick={() => handleRefineSection("detail")}
                            className="text-[11px] h-7 px-2 text-muted-foreground"
                          >
                            + Technical Detail
                          </Button>
                        </div>
                      </div>

                      {/* Content Field */}
                      {isEditing ? (
                        <Textarea
                          rows={12}
                          value={currentSection.content}
                          onChange={(e) => handleContentChange(e.target.value)}
                          className="font-mono text-xs leading-relaxed"
                        />
                      ) : (
                        <div className="rounded-lg border border-border/60 bg-muted/20 p-4 text-xs font-sans whitespace-pre-wrap leading-relaxed">
                          {currentSection.content}
                        </div>
                      )}

                      {/* Memory Citations Badge */}
                      {currentSection.informedBy.length > 0 && (
                        <div className="flex items-center gap-2 pt-2 text-xs text-purple-700 dark:text-purple-300 font-medium">
                          <Brain className="h-3.5 w-3.5 text-purple-500" />
                          <span>
                            This section was shaped by {currentSection.informedBy.length} recalled
                            Hindsight memories.
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="rfp" className="mt-4">
              <Card className="border-border/60 shadow-sm">
                <CardHeader>
                  <CardTitle className="text-base">Original RFP Content</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="font-mono text-xs whitespace-pre-wrap text-muted-foreground leading-relaxed">
                    {proposal.rfpContent || "No RFP text provided."}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right 1 Col: Agent Strategy & Recalled Experiences */}
        <div className="space-y-4">
          {/* Strategy Rationale Card */}
          <Card className="border-purple-500/30 bg-gradient-to-b from-purple-50/30 to-background dark:from-purple-950/10 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-500" /> Why this proposal?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-3">
              <p className="text-foreground leading-relaxed">
                {rec?.strategy ||
                  proposal.strategy ||
                  "No strategy was recorded for this proposal."}
              </p>

              {!!rec?.reasoning.length && (
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                  {rec.reasoning.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              )}

              {!!rec?.successfulPatterns.length && (
                <div className="flex flex-wrap gap-1">
                  {rec.successfulPatterns.map((p, i) => (
                    <Badge key={i} className="bg-emerald-500/15 text-emerald-700 text-[10px]">
                      ✓ {p}
                    </Badge>
                  ))}
                </div>
              )}
              {!!rec?.warnings.length && (
                <div className="flex flex-wrap gap-1">
                  {rec.warnings.map((w, i) => (
                    <Badge key={i} className="bg-rose-500/15 text-rose-700 text-[10px]">
                      ⚠ {w}
                    </Badge>
                  ))}
                </div>
              )}

              {rec && (
                <p className="text-[10px] text-muted-foreground">
                  {rec.source === "hindsight-reflect"
                    ? "Synthesised by Hindsight reflect from the experiences below."
                    : rec.source === "llm"
                      ? "Synthesised by the LLM from experiences recalled via Hindsight."
                      : rec.summary}
                </p>
              )}

              <div className="pt-2 border-t border-purple-500/20 space-y-2">
                <span className="font-semibold text-muted-foreground text-[11px]">
                  Experiences recalled from Hindsight ({recalledMemories.length})
                </span>
                {recalledMemories.length === 0 ? (
                  <p className="text-muted-foreground text-[11px] italic">
                    No previous experience was used — generated from the RFP alone.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recalledMemories.map((m) => (
                      <div
                        key={m.id}
                        className="p-2.5 rounded border border-purple-500/20 bg-background/80 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2 font-semibold text-[11px] text-foreground">
                          <span>{m.title}</span>
                          <Badge
                            className={
                              m.outcome === "won"
                                ? "bg-emerald-500/15 text-emerald-700 text-[9px]"
                                : m.outcome === "lost"
                                  ? "bg-rose-500/15 text-rose-700 text-[9px]"
                                  : "bg-amber-500/15 text-amber-700 text-[9px]"
                            }
                          >
                            {m.outcome.toUpperCase()}
                          </Badge>
                        </div>
                        {typeof m.relevance === "number" && (
                          <p className="text-[10px] text-purple-600 dark:text-purple-400">
                            {Math.round(m.relevance * 100)}% relevant
                          </p>
                        )}
                        <p className="text-muted-foreground text-[10px] line-clamp-3">
                          {m.lessons[0] ?? m.content}
                        </p>
                        {m.relevanceReasons?.slice(0, 2).map((r, i) => (
                          <p
                            key={i}
                            className="text-[10px] text-muted-foreground italic line-clamp-2"
                          >
                            {r}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Quick Outcome Recorder Box */}
          <Card className="border-border/60">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold">Proposal Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Once the evaluation decision is known, record the outcome to retain lessons in
                Hindsight.
              </p>
              <Button
                onClick={() => setIsOutcomeModalOpen(true)}
                className="w-full bg-purple-600 hover:bg-purple-500 text-white gap-2 text-xs"
              >
                <Database className="h-3.5 w-3.5" /> Record WON / LOST Outcome
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Outcome Modal */}
      <OutcomeModal
        open={isOutcomeModalOpen}
        onOpenChange={setIsOutcomeModalOpen}
        proposal={proposal}
        onOutcomeSaved={handleOutcomeSaved}
      />
    </div>
  );
}
