import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { clients, proposals, saveStore } from "@/services/proposals/store.server";
import type { AgentRecommendation, Proposal, RFPAnalysis } from "@/types";

const schema = z.object({
  title: z.string().min(1),
  clientName: z.string().min(1),
  industry: z.string().min(1),
  value: z.number().optional(),
  rfpContent: z.string().default(""),
  sections: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        content: z.string(),
        informedBy: z.array(z.string()),
      }),
    )
    .default([]),
  strategy: z.string().optional(),
  recommendationMemoryIds: z.array(z.string()).default([]),
  analysis: z.custom<RFPAnalysis>((v) => !!v && typeof v === "object").optional(),
  recommendation: z.custom<AgentRecommendation>((v) => !!v && typeof v === "object").optional(),
});

export const Route = createFileRoute("/api/proposals")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          proposals: [...proposals].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
        }),
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) return Response.json({ error: "Invalid proposal" }, { status: 400 });
        const data = parsed.data;

        let client = clients.find((c) => c.name.toLowerCase() === data.clientName.toLowerCase());
        if (!client) {
          client = {
            id: `c-${Date.now()}`,
            name: data.clientName,
            industry: data.industry as never,
            preferences: [],
            importantRequirements: [],
            learnedPatterns: [],
          };
          clients.push(client);
        }

        const now = new Date().toISOString();
        const proposal: Proposal = {
          id: `p-${Date.now()}`,
          title: data.title,
          clientId: client.id,
          clientName: client.name,
          industry: data.industry as never,
          status: "draft",
          rfpContent: data.rfpContent,
          sections: data.sections,
          value: data.value ?? 0,
          ...(data.strategy === undefined ? {} : { strategy: data.strategy }),
          recommendationMemoryIds: data.recommendation
            ? data.recommendation.basedOn.map((m) => m.id)
            : data.recommendationMemoryIds,
          ...(data.analysis ? { analysis: data.analysis } : {}),
          ...(data.recommendation ? { recommendation: data.recommendation } : {}),
          createdAt: now,
          updatedAt: now,
        };
        proposals.unshift(proposal);
        await saveStore();
        return Response.json({ proposal }, { status: 201 });
      },
    },
  },
});
