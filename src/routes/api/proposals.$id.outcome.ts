import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { outcomes, proposals } from "@/services/proposals/store.server";
import { getMemoryStatus, retainMemory } from "@/services/hindsight/hindsight.server";
import type { Memory, ProposalOutcome } from "@/types";

const schema = z.object({
  status: z.enum(["won", "lost", "pending"]),
  successfulFactors: z.array(z.string()).default([]),
  failureFactors: z.array(z.string()).default([]),
  lessons: z.string().default(""),
});

export const Route = createFileRoute("/api/proposals/$id/outcome")({
  server: {
    handlers: {
      POST: async ({ params, request }) => {
        const proposal = proposals.find((p) => p.id === params.id);
        if (!proposal) return Response.json({ error: "Not found" }, { status: 404 });

        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) return Response.json({ error: "Invalid outcome" }, { status: 400 });
        const data = parsed.data;

        const outcome: ProposalOutcome = {
          proposalId: proposal.id,
          ...data,
          recordedAt: new Date().toISOString(),
        };
        const existing = outcomes.findIndex((o) => o.proposalId === proposal.id);
        if (existing >= 0) outcomes[existing] = outcome;
        else outcomes.push(outcome);

        proposal.status = data.status;
        proposal.updatedAt = outcome.recordedAt;

        const memory: Memory = {
          id: `m-${Date.now()}`,
          title: `${proposal.title} — ${data.status[0].toUpperCase()}${data.status.slice(1)}`,
          sourceProposalId: proposal.id,
          industry: proposal.industry,
          outcome: data.status,
          clientType: proposal.clientName,
          content: data.lessons || `Outcome recorded for ${proposal.title}.`,
          lessons: data.lessons ? data.lessons.split(/\n+/).filter(Boolean) : [],
          successfulPatterns: data.successfulFactors,
          failedPatterns: data.failureFactors,
          createdAt: outcome.recordedAt,
        };

        // Hindsight RETAIN. Falls back to the local workspace store while
        // Hindsight is not configured — the UI reports which mode ran.
        const retained = await retainMemory(memory);

        return Response.json({ outcome, memory: retained, memoryStatus: getMemoryStatus() });
      },
    },
  },
});
