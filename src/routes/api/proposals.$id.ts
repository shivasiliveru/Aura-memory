import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { memories, outcomes, proposals } from "@/services/proposals/store.server";

const patchSchema = z.object({
  sections: z
    .array(z.object({ id: z.string(), title: z.string(), content: z.string(), informedBy: z.array(z.string()) }))
    .optional(),
  title: z.string().optional(),
  status: z.enum(["draft", "pending", "won", "lost"]).optional(),
});

export const Route = createFileRoute("/api/proposals/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const proposal = proposals.find((p) => p.id === params.id);
        if (!proposal) return Response.json({ error: "Not found" }, { status: 404 });
        return Response.json({
          proposal,
          outcome: outcomes.find((o) => o.proposalId === proposal.id) ?? null,
          basedOn: memories.filter((m) => proposal.recommendationMemoryIds.includes(m.id)),
        });
      },
      PATCH: async ({ params, request }) => {
        const proposal = proposals.find((p) => p.id === params.id);
        if (!proposal) return Response.json({ error: "Not found" }, { status: 404 });
        const parsed = patchSchema.safeParse(await request.json());
        if (!parsed.success) return Response.json({ error: "Invalid patch" }, { status: 400 });
        Object.assign(proposal, parsed.data, { updatedAt: new Date().toISOString() });
        return Response.json({ proposal });
      },
    },
  },
});
