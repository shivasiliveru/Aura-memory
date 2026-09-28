import React, { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Navbar, type ActiveTab } from "@/components/proposal-intelligence/Navbar";
import { DashboardView } from "@/components/proposal-intelligence/DashboardView";
import { NewRFPWizard } from "@/components/proposal-intelligence/NewRFPWizard";
import { ProposalDetailView } from "@/components/proposal-intelligence/ProposalDetailView";
import { MemoryBankView } from "@/components/proposal-intelligence/MemoryBankView";
import { InsightsView } from "@/components/proposal-intelligence/InsightsView";
import type {
  InsightsPayload,
  Memory,
  MemoryProviderStatus,
  Proposal,
  RecalledMemory,
} from "@/types";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Aura Memory — AI Proposal & RFP Agent with Hindsight Memory" },
      {
        name: "description",
        content:
          "AI-powered proposal generation agent powered by Hindsight long-term memory learning loop.",
      },
    ],
  }),
});

function Index() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("dashboard");
  const [selectedProposalId, setSelectedProposalId] = useState<string>("");

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [insights, setInsights] = useState<InsightsPayload | null>(null);
  const [memoryStatus, setMemoryStatus] = useState<MemoryProviderStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Selected proposal details
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [recalledForSelected, setRecalledForSelected] = useState<RecalledMemory[]>([]);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [propRes, memRes, insRes] = await Promise.all([
        fetch("/api/proposals"),
        fetch("/api/memory"),
        fetch("/api/insights"),
      ]);

      if (propRes.ok) {
        const pData = await propRes.json();
        setProposals(pData.proposals || []);
      }
      if (memRes.ok) {
        const mData = await memRes.json();
        setMemories(mData.memories || []);
        if (mData.status) setMemoryStatus(mData.status);
      }
      if (insRes.ok) {
        const iData = await insRes.json();
        setInsights(iData);
      }
    } catch (err) {
      console.error("Failed to fetch initial application data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fetch selected proposal detail
  const handleSelectProposal = async (id: string) => {
    if (!id) {
      setActiveTab("proposals");
      return;
    }
    setSelectedProposalId(id);
    setActiveTab("proposal-detail");

    try {
      const res = await fetch(`/api/proposals/${id}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedProposal(data.proposal);
        setRecalledForSelected(data.basedOn || []);
      }
    } catch (err) {
      console.error("Failed to fetch proposal details:", err);
    }
  };

  const handleProposalCreated = (newId: string) => {
    fetchData();
    handleSelectProposal(newId);
  };

  const handleProposalUpdated = (updated: Proposal) => {
    setSelectedProposal(updated);
    setProposals((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    fetchData();
  };

  const handleMemoryAdded = (newMemory: Memory) => {
    setMemories((prev) => [newMemory, ...prev]);
    fetchData();
  };

  return (
    <div className="min-h-screen bg-background font-sans antialiased text-foreground selection:bg-purple-500/20">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        memoryStatus={memoryStatus}
        onNewProposal={() => setActiveTab("new-rfp")}
      />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-6">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center space-x-2 text-muted-foreground">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
            <span className="text-sm font-medium">Loading Aura Memory...</span>
          </div>
        ) : (
          <>
            {activeTab === "dashboard" && (
              <DashboardView
                proposals={proposals}
                memories={memories}
                memoryStatus={memoryStatus}
                onSelectProposal={handleSelectProposal}
                onNewProposal={() => setActiveTab("new-rfp")}
                onViewMemories={() => setActiveTab("memories")}
                onViewInsights={() => setActiveTab("insights")}
              />
            )}

            {activeTab === "new-rfp" && (
              <NewRFPWizard onProposalCreated={handleProposalCreated} memoryStatus={memoryStatus} />
            )}

            {(activeTab === "proposals" ||
              (activeTab === "proposal-detail" && !selectedProposal)) && (
              <div className="space-y-6 pb-12">
                <div className="flex items-center justify-between border-b border-border/60 pb-4">
                  <div>
                    <h1 className="text-2xl font-bold tracking-tight text-foreground">
                      Proposals Library
                    </h1>
                    <p className="text-xs text-muted-foreground">
                      Manage all generated proposals, review recommendations, and record outcomes.
                    </p>
                  </div>
                </div>

                <DashboardView
                  proposals={proposals}
                  memories={memories}
                  memoryStatus={memoryStatus}
                  onSelectProposal={handleSelectProposal}
                  onNewProposal={() => setActiveTab("new-rfp")}
                  onViewMemories={() => setActiveTab("memories")}
                  onViewInsights={() => setActiveTab("insights")}
                />
              </div>
            )}

            {activeTab === "proposal-detail" && selectedProposal && (
              <ProposalDetailView
                proposal={selectedProposal}
                recalledMemories={recalledForSelected}
                onBack={() => setActiveTab("dashboard")}
                onProposalUpdated={handleProposalUpdated}
              />
            )}

            {activeTab === "memories" && (
              <MemoryBankView
                memories={memories}
                memoryStatus={memoryStatus}
                onMemoryAdded={handleMemoryAdded}
              />
            )}

            {activeTab === "insights" && (
              <InsightsView insights={insights} proposals={proposals} memories={memories} />
            )}
          </>
        )}
      </main>
    </div>
  );
}
