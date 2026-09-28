import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  clients,
  memories,
  outcomes,
  proposals,
  saveStore,
} from "@/services/proposals/store.server";
import { extractLearning } from "@/services/learning/extract.server";
import {
  HindsightError,
  getMemoryStatus,
  retainMemory,
} from "@/services/hindsight/hindsight.server";
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

        const learning = await extractLearning(proposal, data);

        // Re-recording an outcome updates the proposal's existing memory instead of duplicating it.
        const previous = memories.find((m) => m.sourceProposalId === proposal.id);
        const memory: Memory = {
          id: previous?.id ?? `m-${Date.now()}`,
          title: `${proposal.title} — ${data.status.charAt(0).toUpperCase()}${data.status.slice(1)}`,
          sourceProposalId: proposal.id,
          industry: proposal.industry,
          outcome: data.status,
          clientType: proposal.clientName,
          content: learning.summary,
          lessons: learning.lessons,
          successfulPatterns: learning.successfulPatterns,
          failedPatterns: learning.failedPatterns,
          rfpContext: learning.rfpContext,
          clientPreferences: learning.clientPreferences,
          recommendations: learning.recommendations,
          extractedBy: learning.extractedBy,
          ...(proposal.strategy ? { strategy: proposal.strategy } : {}),
          createdAt: outcome.recordedAt,
        };

        const client = clients.find((c) => c.id === proposal.clientId);
        if (client && learning.clientPreferences.length) {
          client.learnedPatterns = Array.from(
            new Set([...client.learnedPatterns, ...learning.clientPreferences]),
          );
        }

        try {
          const retained = await retainMemory(memory);
          return Response.json({
            outcome,
            memory: retained,
            memoryStatus: await getMemoryStatus(),
          });
        } catch (err) {
          if (!(err instanceof HindsightError)) throw err;
          await saveStore();
          return Response.json(
            { error: `Outcome saved, but Hindsight retain failed: ${err.message}`, outcome },
            { status: err.status === 503 ? 503 : 502 },
          );
        }
      },
    },
  },
});
