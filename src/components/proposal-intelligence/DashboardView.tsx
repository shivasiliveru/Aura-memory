import React from "react";
import {
  Brain,
  FileText,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  ArrowRight,
  Database,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Memory, MemoryProviderStatus, Proposal } from "@/types";

interface DashboardViewProps {
  proposals: Proposal[];
  memories: Memory[];
  memoryStatus: MemoryProviderStatus | null;
  onSelectProposal: (proposalId: string) => void;
  onNewProposal: () => void;
  onViewMemories: () => void;
  onViewInsights: () => void;
}

export function DashboardView({
  proposals,
  memories,
  memoryStatus,
  onSelectProposal,
  onNewProposal,
  onViewMemories,
  onViewInsights,
}: DashboardViewProps) {
  const wonCount = proposals.filter((p) => p.status === "won").length;
  const lostCount = proposals.filter((p) => p.status === "lost").length;
  const pendingCount = proposals.filter(
    (p) => p.status === "pending" || p.status === "draft",
  ).length;
  const totalDecided = wonCount + lostCount;
  const winRate = totalDecided > 0 ? Math.round((wonCount / totalDecided) * 100) : 0;
  const totalValue = proposals.reduce((acc, p) => acc + (p.value || 0), 0);
  const wonValue = proposals
    .filter((p) => p.status === "won")
    .reduce((acc, p) => acc + (p.value || 0), 0);

  const recentProposals = proposals.slice(0, 6);
  const recentMemories = memories.slice(0, 4);

  return (
    <div className="space-y-8 pb-12">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 sm:p-8 text-white shadow-xl border border-indigo-500/20">
        <div className="absolute -right-12 -top-12 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-12 -bottom-12 h-64 w-64 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-500/20 px-3 py-1 text-xs font-semibold text-indigo-300 border border-indigo-400/30">
              <Brain className="h-3.5 w-3.5 text-indigo-400" />
              <span>Hindsight Memory-Driven Proposal Agent</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
              AI Proposal Intelligence Dashboard
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Every proposal outcome is stored into long-term memory. Future proposals automatically
              recall past wins, avoid recorded failure pitfalls, and adapt strategies over time.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={onNewProposal}
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Analyze New RFP
            </Button>
            <Button
              onClick={onViewMemories}
              variant="outline"
              size="lg"
              className="border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-200 gap-2"
            >
              <Database className="h-4 w-4 text-purple-400" />
              View Memory Bank ({memories.length})
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Proposals
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <FileText className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{proposals.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              ${(totalValue / 1000).toFixed(0)}k total pipeline value
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Proposal Win Rate
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{winRate}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              {wonCount} Won · {lostCount} Lost (${(wonValue / 1000).toFixed(0)}k won value)
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Active Pending RFPs
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Clock className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Awaiting evaluation or review</p>
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Hindsight Memories
            </CardTitle>
            <div className="h-8 w-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center">
              <Brain className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{memories.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Experiences retained for AI recall</p>
          </CardContent>
        </Card>
      </div>

      {/* Grid Section: Recent Proposals & Hindsight Memory Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Recent Proposals Table */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Recent Proposals</CardTitle>
                <CardDescription>
                  Review proposal progress, agent recommendations, and outcome records.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onSelectProposal("")}
                className="gap-1"
              >
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="divide-y divide-border/60">
                {recentProposals.map((prop) => (
                  <div
                    key={prop.id}
                    onClick={() => onSelectProposal(prop.id)}
                    className="group flex flex-col sm:flex-row sm:items-center justify-between py-3.5 px-2 hover:bg-accent/40 rounded-lg transition-colors cursor-pointer gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm">
                          {prop.title}
                        </span>
                        <Badge variant="outline" className="text-[10px] font-normal">
                          {prop.industry}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Client:{" "}
                        <span className="font-medium text-foreground">{prop.clientName}</span> ·
                        Value: ${prop.value.toLocaleString()}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 justify-between sm:justify-end">
                      {prop.status === "won" && (
                        <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:bg-emerald-950 dark:text-emerald-400 gap-1 text-xs">
                          <CheckCircle2 className="h-3 w-3" /> Won
                        </Badge>
                      )}
                      {prop.status === "lost" && (
                        <Badge className="bg-rose-500/15 text-rose-700 hover:bg-rose-500/25 dark:bg-rose-950 dark:text-rose-400 gap-1 text-xs">
                          <XCircle className="h-3 w-3" /> Lost
                        </Badge>
                      )}
                      {(prop.status === "pending" || prop.status === "draft") && (
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Clock className="h-3 w-3" />{" "}
                          {prop.status === "pending" ? "Pending" : "Draft"}
                        </Badge>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground group-hover:text-foreground"
                      >
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Recent Hindsight Learning Insights */}
        <div className="space-y-4">
          <Card className="border-border/60 shadow-sm bg-gradient-to-b from-purple-50/40 to-background dark:from-purple-950/10">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-purple-500/15 text-purple-600 flex items-center justify-center">
                    <Brain className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Learning Memory Loop</CardTitle>
                    <CardDescription className="text-xs">
                      Hindsight Memory Highlights
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onViewInsights}
                  className="text-xs text-purple-600 dark:text-purple-400 p-1 h-auto"
                >
                  Analytics
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-1">
                <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> Key Success Driver
                  </span>
                  <Badge variant="outline" className="border-purple-300 text-[10px]">
                    Healthcare
                  </Badge>
                </div>
                <p className="text-muted-foreground leading-normal">
                  "Detailed security architecture and explicit compliance evidence moved committee
                  decisions in Healthcare bids."
                </p>
              </div>

              <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
                <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Recorded Avoidance
                    Pitfall
                  </span>
                  <Badge variant="outline" className="border-amber-300 text-[10px]">
                    Banking & FinTech
                  </Badge>
                </div>
                <p className="text-muted-foreground leading-normal">
                  "Generic pricing without ROI quantification caused losses. Proposals now
                  automatically include ROI payback period models."
                </p>
              </div>

              <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                <span className="text-muted-foreground text-[11px]">
                  Total experiences retained:
                </span>
                <span className="font-bold text-foreground">{memories.length} memories</span>
              </div>

              <Button
                variant="outline"
                className="w-full text-xs gap-1.5 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-500/10"
                onClick={onViewMemories}
              >
                <Database className="h-3.5 w-3.5" /> Explore Hindsight Memory Bank
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
