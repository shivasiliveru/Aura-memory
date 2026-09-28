import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clients, proposals, saveStore } from "@/services/proposals/store.server";

const schema = z.object({
  name: z.string().min(1),
  industry: z.string().min(1),
  preferences: z.array(z.string()).default([]),
  importantRequirements: z.array(z.string()).default([]),
});

export const Route = createFileRoute("/api/clients")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          clients: clients.map((client) => {
            const own = proposals.filter((p) => p.clientId === client.id);
            const won = own.filter((p) => p.status === "won").length;
            const lost = own.filter((p) => p.status === "lost").length;
            const last = own
              .map((p) => p.createdAt)
              .sort()
              .pop();
            return {
              ...client,
              proposals: own.length,
              won,
              lost,
              lastProposal: last ?? null,
              successRate: Math.round((won / Math.max(1, won + lost)) * 100),
            };
          }),
        }),
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) return Response.json({ error: "Invalid client" }, { status: 400 });
        const client = {
          id: `c-${Date.now()}`,
          ...parsed.data,
          industry: parsed.data.industry as never,
          learnedPatterns: [],
        };
        clients.push(client);
        await saveStore();
        return Response.json({ client }, { status: 201 });
      },
    },
  },
});
