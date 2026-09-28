import React, { useState } from "react";
import {
  Brain,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Loader2,
  Database,
  ThumbsUp,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { Memory, Outcome, Proposal } from "@/types";

interface OutcomeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal;
  onOutcomeSaved: (proposalId: string, outcome: Outcome, memory: Memory) => void;
}

const WON_FACTOR_OPTIONS = [
  "Detailed Security Architecture",
  "Early Compliance Chapter",
  "Specific Implementation Timeline",
  "Quantified ROI / Payback Model",
  "Technical Depth & Integration Detail",
  "Customized Workflow Mapping",
  "Competitive & Transparent Pricing",
  "Named Workstream Leads",
];

const LOST_FACTOR_OPTIONS = [
  "Generic Pricing Language",
  "Weak ROI Explanation",
  "Conceptual / Vague Implementation Plan",
  "Insufficient Technical Detail",
  "Generic Template Messaging",
  "Missing Compliance Evidence",
  "Lack of Customization",
  "Competitor Specialist Advantage",
];

export function OutcomeModal({ open, onOpenChange, proposal, onOutcomeSaved }: OutcomeModalProps) {
  const [status, setStatus] = useState<Outcome>("won");
  const [selectedFactors, setSelectedFactors] = useState<string[]>([]);
  const [lessons, setLessons] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [retained, setRetained] = useState<Memory | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (!next) setRetained(null);
    onOpenChange(next);
  };

  const toggleFactor = (factor: string) => {
    setSelectedFactors((prev) =>
      prev.includes(factor) ? prev.filter((f) => f !== factor) : [...prev, factor],
    );
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMsg("");

    try {
      const res = await fetch(`/api/proposals/${proposal.id}/outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          successfulFactors: status === "won" ? selectedFactors : [],
          failureFactors: status === "lost" ? selectedFactors : [],
          lessons,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Failed to record outcome");
      }

      const data = await res.json();
      onOutcomeSaved(proposal.id, status, data.memory);
      // Stay open to show what the agent learned and retained.
      setRetained(data.memory);
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Failed to save proposal outcome.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg border-border/60 shadow-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Brain className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-lg">Record Proposal Outcome</DialogTitle>
              <DialogDescription className="text-xs">
                Store outcome & lessons into Hindsight memory bank for future RFPs.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {retained ? (
          <RetainedSummary memory={retained} />
        ) : (
          <div className="space-y-5 py-2 text-xs">
            {/* Proposal Summary Badge */}
            <div className="rounded-lg bg-accent/50 p-3 flex items-center justify-between">
              <span className="font-semibold text-foreground text-xs">{proposal.title}</span>
              <Badge variant="outline" className="text-[10px]">
                {proposal.industry}
              </Badge>
            </div>

            {/* Outcome Selection Buttons */}
            <div className="space-y-1.5">
              <Label className="font-semibold text-xs">Proposal Outcome Status *</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant={status === "won" ? "default" : "outline"}
                  className={
                    status === "won"
                      ? "bg-emerald-600 text-white hover:bg-emerald-500 gap-1.5"
                      : "gap-1.5"
                  }
                  onClick={() => {
                    setStatus("won");
                    setSelectedFactors([]);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" /> WON
                </Button>

                <Button
                  type="button"
                  variant={status === "lost" ? "default" : "outline"}
                  className={
                    status === "lost"
                      ? "bg-rose-600 text-white hover:bg-rose-500 gap-1.5"
                      : "gap-1.5"
                  }
                  onClick={() => {
                    setStatus("lost");
                    setSelectedFactors([]);
                  }}
                >
                  <XCircle className="h-4 w-4" /> LOST
                </Button>

                <Button
                  type="button"
                  variant={status === "pending" ? "default" : "outline"}
                  className={
                    status === "pending"
                      ? "bg-amber-600 text-white hover:bg-amber-500 gap-1.5"
                      : "gap-1.5"
                  }
                  onClick={() => {
                    setStatus("pending");
                    setSelectedFactors([]);
                  }}
                >
                  <Clock className="h-4 w-4" /> PENDING
                </Button>
              </div>
            </div>

            {/* Decision Factor Checkboxes */}
            {status !== "pending" && (
              <div className="space-y-2">
                <Label className="font-semibold text-xs">
                  {status === "won"
                    ? "What Worked Well? (Select factors to repeat)"
                    : "What Cost the Bid? (Select pitfalls to avoid)"}
                </Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                  {(status === "won" ? WON_FACTOR_OPTIONS : LOST_FACTOR_OPTIONS).map((factor) => (
                    <label
                      key={factor}
                      className="flex items-center gap-2 p-2 rounded-md border border-border/60 hover:bg-accent/40 cursor-pointer text-xs transition-colors"
                    >
                      <Checkbox
                        checked={selectedFactors.includes(factor)}
                        onCheckedChange={() => toggleFactor(factor)}
                      />
                      <span className="text-foreground leading-snug">{factor}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Lessons Learned Free-text */}
            <div className="space-y-1.5">
              <Label htmlFor="lessons-input" className="font-semibold text-xs">
                Key Lessons & Takeaways for Hindsight Memory *
              </Label>
              <Textarea
                id="lessons-input"
                rows={3}
                placeholder={
                  status === "won"
                    ? "e.g. Detailed security architecture and naming workstream leads increased evaluation committee confidence."
                    : "e.g. Generic pricing caused lost bid. Future proposals must break down per-facility pricing and quantify ROI."
                }
                value={lessons}
                onChange={(e) => setLessons(e.target.value)}
                className="text-xs"
              />
            </div>

            {errorMsg && <p className="text-xs text-rose-600 font-medium">{errorMsg}</p>}

            <div className="rounded-md border border-purple-500/20 bg-purple-500/5 p-2.5 flex items-center gap-2 text-[11px] text-purple-700 dark:text-purple-300">
              <Database className="h-4 w-4 shrink-0 text-purple-500" />
              <span>
                Saving this outcome triggers <strong>Hindsight RETAIN</strong>. Future RFPs will
                recall these lessons.
              </span>
            </div>
          </div>
        )}

        {retained ? (
          <DialogFooter>
            <Button size="sm" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        ) : (
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-purple-600 hover:bg-purple-500 text-white gap-2 shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Extracting lessons & retaining...
                </>
              ) : (
                <>
                  <Database className="h-4 w-4" /> Save Outcome & Retain Memory
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LearnedList({
  label,
  items,
  tone,
}: {
  label: string;
  items?: string[] | undefined;
  tone: string;
}) {
  if (!items?.length) return null;
  return (
    <div className="space-y-1">
      <span className={`font-semibold text-[11px] uppercase tracking-wider ${tone}`}>{label}</span>
      <ul className="list-disc pl-4 space-y-0.5 text-foreground">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function RetainedSummary({ memory }: { memory: Memory }) {
  return (
    <div className="space-y-4 py-2 text-xs max-h-[60vh] overflow-y-auto pr-1">
      <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5 flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" />
        <span>
          Retained in <strong>Hindsight</strong>. Future similar RFPs will recall this experience.
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span className="font-semibold text-foreground">{memory.title}</span>
        </div>
        <p className="text-muted-foreground leading-relaxed">{memory.content}</p>
        <p className="text-[10px] text-muted-foreground">
          {memory.extractedBy === "llm"
            ? "Lessons structured by the AI from your feedback, the RFP and the proposal."
            : "Lessons stored as you entered them."}
        </p>
      </div>

      <LearnedList
        label="Lessons learned"
        items={memory.lessons}
        tone="text-purple-600 dark:text-purple-400"
      />
      <LearnedList
        label="What worked"
        items={memory.successfulPatterns}
        tone="text-emerald-600 dark:text-emerald-400"
      />
      <LearnedList
        label="What failed"
        items={memory.failedPatterns}
        tone="text-rose-600 dark:text-rose-400"
      />
      <LearnedList
        label="Client preferences"
        items={memory.clientPreferences}
        tone="text-sky-600 dark:text-sky-400"
      />
      <LearnedList
        label="Next time"
        items={memory.recommendations}
        tone="text-amber-600 dark:text-amber-400"
      />
    </div>
  );
}
