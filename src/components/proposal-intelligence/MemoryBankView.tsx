import React, { useState } from "react";
import {
  Brain,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Database,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  Lightbulb,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Industry, Memory, MemoryProviderStatus, Outcome } from "@/types";

interface MemoryBankViewProps {
  memories: Memory[];
  memoryStatus: MemoryProviderStatus | null;
  onMemoryAdded: (newMemory: Memory) => void;
}

export function MemoryBankView({ memories, memoryStatus, onMemoryAdded }: MemoryBankViewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("all");

  // Add Custom Memory Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newIndustry, setNewIndustry] = useState<Industry>("Healthcare");
  const [newOutcome, setNewOutcome] = useState<Outcome>("won");
  const [newContent, setNewContent] = useState("");
  const [newLessons, setNewLessons] = useState("");
  const [newPatterns, setNewPatterns] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [retainError, setRetainError] = useState("");

  const filteredMemories = memories.filter((m) => {
    const matchesSearch =
      searchTerm === "" ||
      m.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
      m.lessons.some((l) => l.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesIndustry = industryFilter === "all" || m.industry === industryFilter;
    const matchesOutcome = outcomeFilter === "all" || m.outcome === outcomeFilter;
    return matchesSearch && matchesIndustry && matchesOutcome;
  });

  const handleRetainNewMemory = async () => {
    if (!newTitle || !newContent) return;
    setIsSubmitting(true);
    setRetainError("");

    try {
      const res = await fetch("/api/memory/retain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          industry: newIndustry,
          outcome: newOutcome,
          clientType: "Direct Memory Entry",
          content: newContent,
          lessons: newLessons.split("\n").filter(Boolean),
          successfulPatterns:
            newOutcome === "won"
              ? newPatterns
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
          failedPatterns:
            newOutcome === "lost"
              ? newPatterns
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onMemoryAdded(data.memory);
        setIsAddModalOpen(false);
        setNewTitle("");
        setNewContent("");
        setNewLessons("");
        setNewPatterns("");
      } else {
        const body = await res.json().catch(() => null);
        setRetainError(body?.error || `Hindsight retain failed (HTTP ${res.status}).`);
      }
    } catch (err) {
      console.error("Failed to retain memory:", err);
      setRetainError("Could not reach the server.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Brain className="h-6 w-6 text-purple-500" /> Hindsight Long-Term Memory Bank
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Explore retained business experiences. The agent recalls these memories during RFP
            analysis to shape strategies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="border-purple-500/30 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 text-xs py-1"
          >
            {memoryStatus?.mode === "live" ? "Hindsight Live API" : "Hindsight Not Connected"} (
            {memories.length} Memories)
          </Badge>
          <Button
            size="sm"
            onClick={() => setIsAddModalOpen(true)}
            className="bg-purple-600 hover:bg-purple-500 text-white gap-1.5 shadow-sm text-xs"
          >
            <Plus className="h-4 w-4" /> Retain Custom Memory
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search memories, lessons, requirements..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="w-40 text-xs">
                <SelectValue placeholder="All Industries" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                <SelectItem value="Healthcare">Healthcare</SelectItem>
                <SelectItem value="Banking">Banking</SelectItem>
                <SelectItem value="FinTech">FinTech</SelectItem>
                <SelectItem value="SaaS">SaaS</SelectItem>
                <SelectItem value="Manufacturing">Manufacturing</SelectItem>
              </SelectContent>
            </Select>

            <Select value={outcomeFilter} onValueChange={setOutcomeFilter}>
              <SelectTrigger className="w-36 text-xs">
                <SelectValue placeholder="All Outcomes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outcomes</SelectItem>
                <SelectItem value="won">WON</SelectItem>
                <SelectItem value="lost">LOST</SelectItem>
                <SelectItem value="pending">PENDING</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Memories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredMemories.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground space-y-2">
            <Database className="h-8 w-8 mx-auto text-purple-400 opacity-60" />
            <p className="text-sm font-medium">No memories matched your filters.</p>
          </div>
        ) : (
          filteredMemories.map((mem) => (
            <Card
              key={mem.id}
              className="border-border/60 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-[10px] font-normal">
                      {mem.industry}
                    </Badge>
                    <CardTitle className="text-sm font-bold text-foreground leading-snug">
                      {mem.title}
                    </CardTitle>
                  </div>
                  <Badge
                    className={
                      mem.outcome === "won"
                        ? "bg-emerald-500/15 text-emerald-700 text-[10px]"
                        : mem.outcome === "lost"
                          ? "bg-rose-500/15 text-rose-700 text-[10px]"
                          : "bg-amber-500/15 text-amber-700 text-[10px]"
                    }
                  >
                    {mem.outcome.toUpperCase()}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3 text-xs flex-1">
                <p className="text-muted-foreground leading-relaxed line-clamp-3">{mem.content}</p>

                {mem.lessons.length > 0 && (
                  <div className="rounded-md border border-purple-500/20 bg-purple-500/5 p-2.5 space-y-1 text-purple-700 dark:text-purple-300">
                    <span className="font-semibold flex items-center gap-1 text-[11px]">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-500" /> Key Lesson Learned:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-[11px] text-foreground">
                      {mem.lessons.map((l, i) => (
                        <li key={i}>{l}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {!!mem.recommendations?.length && (
                  <div className="space-y-0.5 text-[11px]">
                    <span className="font-semibold text-amber-600 dark:text-amber-400">
                      Next time:
                    </span>
                    <ul className="list-disc list-inside space-y-0.5 text-foreground">
                      {mem.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-1 pt-1">
                  {mem.successfulPatterns.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {mem.successfulPatterns.map((p, i) => (
                        <Badge key={i} className="bg-emerald-500/10 text-emerald-700 text-[10px]">
                          + {p}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {mem.failedPatterns.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {mem.failedPatterns.map((p, i) => (
                        <Badge key={i} className="bg-rose-500/10 text-rose-700 text-[10px]">
                          - {p}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Retain Custom Memory Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" /> Retain Memory to Hindsight
            </DialogTitle>
            <DialogDescription className="text-xs">
              Manually add a proposal experience or business lesson into Hindsight long-term memory.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-xs py-2">
            <div className="space-y-1">
              <Label className="font-semibold text-xs">Title *</Label>
              <Input
                placeholder="e.g. Healthcare Security Audit Addendum — Won"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-semibold text-xs">Industry</Label>
                <Select value={newIndustry} onValueChange={(v) => setNewIndustry(v as Industry)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Healthcare">Healthcare</SelectItem>
                    <SelectItem value="Banking">Banking</SelectItem>
                    <SelectItem value="FinTech">FinTech</SelectItem>
                    <SelectItem value="SaaS">SaaS</SelectItem>
                    <SelectItem value="Manufacturing">Manufacturing</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold text-xs">Outcome</Label>
                <Select value={newOutcome} onValueChange={(v) => setNewOutcome(v as Outcome)}>
                  <SelectTrigger className="text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="won">WON</SelectItem>
                    <SelectItem value="lost">LOST</SelectItem>
                    <SelectItem value="pending">PENDING</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold text-xs">Experience Description / Content *</Label>
              <Textarea
                rows={3}
                placeholder="Detail what happened during the proposal evaluation..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="font-semibold text-xs">Key Lessons (One per line)</Label>
              <Textarea
                rows={2}
                placeholder="e.g. Naming workstream leads increased customer confidence."
                value={newLessons}
                onChange={(e) => setNewLessons(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="font-semibold text-xs">Patterns (Comma separated)</Label>
              <Input
                placeholder="e.g. Security detail, Compliance, Specific timeline"
                value={newPatterns}
                onChange={(e) => setNewPatterns(e.target.value)}
              />
            </div>
          </div>

          {retainError && <p className="text-xs text-rose-600">{retainError}</p>}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsAddModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleRetainNewMemory}
              disabled={isSubmitting}
              className="bg-purple-600 hover:bg-purple-500 text-white gap-2"
            >
              <Database className="h-4 w-4" /> Retain Memory
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
