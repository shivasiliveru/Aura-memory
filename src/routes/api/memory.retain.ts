import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getMemoryStatus, retainMemory } from "@/services/hindsight/hindsight.server";

const schema = z.object({
  title: z.string().min(1),
  sourceProposalId: z.string().default(""),
  industry: z.string().min(1),
  outcome: z.enum(["won", "lost", "pending"]),
  clientType: z.string().default(""),
  content: z.string().default(""),
  lessons: z.array(z.string()).default([]),
  successfulPatterns: z.array(z.string()).default([]),
  failedPatterns: z.array(z.string()).default([]),
});

export const Route = createFileRoute("/api/memory/retain")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) return Response.json({ error: "Invalid memory" }, { status: 400 });
        const memory = await retainMemory({
          id: `m-${Date.now()}`,
          createdAt: new Date().toISOString(),
          ...parsed.data,
          industry: parsed.data.industry as never,
        });
        return Response.json({ memory, status: getMemoryStatus() });
      },
    },
  },
});
