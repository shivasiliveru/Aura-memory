import { createFileRoute } from "@tanstack/react-router";
import { clients, memories, proposals } from "@/services/proposals/store.server";

export const Route = createFileRoute("/api/clients/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const client = clients.find((c) => c.id === params.id);
        if (!client) return Response.json({ error: "Not found" }, { status: 404 });
        const own = proposals.filter((p) => p.clientId === client.id);
        return Response.json({
          client,
          proposals: own,
          memories: memories.filter((m) => own.some((p) => p.id === m.sourceProposalId)),
        });
      },
    },
  },
});
