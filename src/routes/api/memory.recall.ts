import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getMemoryStatus, recallMemories } from "@/services/hindsight/hindsight.server";

const schema = z.object({
  text: z.string().min(1),
  industry: z.string().optional(),
  clientName: z.string().optional(),
  limit: z.number().optional(),
});

export const Route = createFileRoute("/api/memory/recall")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) return Response.json({ error: "Invalid query" }, { status: 400 });
        const recalled = await recallMemories(parsed.data);
        return Response.json({ recalled, status: getMemoryStatus() });
      },
    },
  },
});
