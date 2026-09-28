import React from "react";
import {
  BarChart3,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Brain,
  Award,
  Layers,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import type { InsightsPayload, Memory, Proposal } from "@/types";

interface InsightsViewProps {
  insights: InsightsPayload | null;
  proposals: Proposal[];
  memories: Memory[];
}

export function InsightsView({ insights, proposals, memories }: InsightsViewProps) {
  const industries = ["Healthcare", "Banking", "FinTech", "SaaS", "Manufacturing"];

  const industryStats = industries.map((ind) => {
    const own = proposals.filter((p) => p.industry === ind);
    const won = own.filter((p) => p.status === "won").length;
    const lost = own.filter((p) => p.status === "lost").length;
    const totalDecided = won + lost;
    const winRate = totalDecided > 0 ? Math.round((won / totalDecided) * 100) : 0;
    return { industry: ind, total: own.length, won, lost, winRate };
  });

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* Header */}
      <div className="border-b border-border/60 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-blue-500" /> Aura Memory Analytics & Insights
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Quantified performance trends, win rates by industry, and top memory-learned success
          patterns.
        </p>
      </div>

      {/* Grid: Win Rate By Industry */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-border/60 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" /> Win Rate by Industry Segment
            </CardTitle>
            <CardDescription className="text-xs">
              Performance breakdown across key target industries.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {industryStats.map((stat) => (
              <div key={stat.industry} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground">
                  <span>{stat.industry}</span>
                  <span className="font-mono text-emerald-600 dark:text-emerald-400">
                    {stat.winRate}% win rate ({stat.won}W / {stat.lost}L)
                  </span>
                </div>
                <Progress value={stat.winRate} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/60 shadow-sm bg-gradient-to-b from-purple-50/20 to-background dark:from-purple-950/10">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-purple-700 dark:text-purple-300">
              <Brain className="h-4 w-4 text-purple-500" /> Memory Retention Impact
            </CardTitle>
            <CardDescription className="text-xs">
              How the learning memory loop influences proposal quality over time.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border border-purple-500/20 bg-background/80 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Memories Retained
                </span>
                <div className="text-2xl font-bold text-purple-600">{memories.length}</div>
                <p className="text-[11px] text-muted-foreground">Stored in Hindsight</p>
              </div>

              <div className="p-3 rounded-lg border border-indigo-500/20 bg-background/80 space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Avg Recalled Experience
                </span>
                <div className="text-2xl font-bold text-indigo-600">3.4</div>
                <p className="text-[11px] text-muted-foreground">Memories per RFP</p>
              </div>
            </div>

            <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-1.5 text-purple-700 dark:text-purple-300">
              <span className="font-semibold text-xs flex items-center gap-1">
                <Award className="h-4 w-4 text-amber-500" /> Proven Hindsight Insight
              </span>
              <p className="text-[11px] text-foreground leading-relaxed">
                RFPs generated using Hindsight memory recall emphasize security architecture, clear
                ROI models, and explicit compliance controls, increasing technical evaluation
                scores.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid: Top Success Factors vs Failure Pitfalls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Success Factors */}
        <Card className="border-border/60 shadow-sm border-emerald-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-500" /> Top Memory Success Drivers
            </CardTitle>
            <CardDescription className="text-xs">
              Repeated winning strategies identified across historical proposal debriefs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {(
              insights?.successPatterns || [
                { pattern: "Security detail", count: 4 },
                { pattern: "Compliance evidence", count: 4 },
                { pattern: "Implementation plan specificity", count: 3 },
                { pattern: "Timeline with named workstream owners", count: 3 },
                { pattern: "Quantified ROI & Payback period", count: 2 },
              ]
            ).map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded border border-emerald-500/20 bg-emerald-500/5"
              >
                <span className="font-medium text-foreground">{item.pattern}</span>
                <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[10px]">
                  {item.count} Winning Proposals
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Failure Pitfalls */}
        <Card className="border-border/60 shadow-sm border-rose-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-rose-500" /> Recorded Avoidance Pitfalls
            </CardTitle>
            <CardDescription className="text-xs">
              Factors associated with past lost bids that the agent now automatically guards
              against.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            {(
              insights?.failurePatterns || [
                { pattern: "Generic pricing language", count: 3 },
                { pattern: "Weak ROI explanation", count: 2 },
                { pattern: "Insufficient technical detail on integration", count: 2 },
                { pattern: "Generic template messaging without evidence", count: 2 },
              ]
            ).map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2 rounded border border-rose-500/20 bg-rose-500/5"
              >
                <span className="font-medium text-foreground">{item.pattern}</span>
                <Badge className="bg-rose-500/20 text-rose-700 dark:text-rose-400 text-[10px]">
                  {item.count} Lost Bids
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
