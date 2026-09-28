import React from "react";
import {
  Brain,
  Sparkles,
  Plus,
  Database,
  BarChart3,
  FileText,
  LayoutDashboard,
  Lightbulb,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { MemoryProviderStatus } from "@/types";

export type ActiveTab =
  "dashboard" | "new-rfp" | "proposals" | "proposal-detail" | "memories" | "insights";

interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  memoryStatus: MemoryProviderStatus | null;
  onNewProposal: () => void;
}

export function Navbar({ activeTab, setActiveTab, memoryStatus, onNewProposal }: NavbarProps) {
  const isLive = memoryStatus?.mode === "live";

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab("dashboard")}
            className="flex items-center gap-2.5 text-left transition-opacity hover:opacity-90"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Brain className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground text-lg tracking-tight">
                  Aura Memory
                </span>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary uppercase tracking-wider">
                  AI Agent
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">Hindsight Long-Term Memory</p>
            </div>
          </button>

          {/* Navigation Items */}
          <nav className="hidden md:flex items-center gap-1">
            <Button
              variant={activeTab === "dashboard" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("dashboard")}
              className="gap-2"
            >
              <LayoutDashboard className="h-4 w-4" />
              Dashboard
            </Button>

            <Button
              variant={activeTab === "new-rfp" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("new-rfp")}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4 text-amber-500" />
              New RFP Agent
            </Button>

            <Button
              variant={
                activeTab === "proposals" || activeTab === "proposal-detail" ? "secondary" : "ghost"
              }
              size="sm"
              onClick={() => setActiveTab("proposals")}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Proposals
            </Button>

            <Button
              variant={activeTab === "memories" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("memories")}
              className="gap-2"
            >
              <Database className="h-4 w-4 text-purple-500" />
              Hindsight Memory Bank
            </Button>

            <Button
              variant={activeTab === "insights" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("insights")}
              className="gap-2"
            >
              <BarChart3 className="h-4 w-4 text-blue-500" />
              Insights
            </Button>
          </nav>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {/* Hindsight Status Badge */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground font-medium">Memory Provider:</span>
            <Badge
              variant="outline"
              className={
                isLive
                  ? "border-emerald-500/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400"
                  : "border-purple-500/30 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400"
              }
            >
              <span
                className={`mr-1.5 h-2 w-2 rounded-full ${
                  isLive ? "bg-emerald-500 animate-pulse" : "bg-purple-500"
                }`}
              />
              {isLive ? "Hindsight Live API" : "Hindsight Workspace Memory"}
            </Badge>
          </div>

          <Button size="sm" onClick={onNewProposal} className="gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            New RFP Proposal
          </Button>
        </div>
      </div>
    </header>
  );
}
