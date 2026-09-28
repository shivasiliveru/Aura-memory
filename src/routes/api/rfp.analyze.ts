import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { analyzeRFP } from "@/services/rfp/analyze.server";
import {
  HindsightError,
  getMemoryStatus,
  recallMemories,
  reflectOnMemories,
} from "@/services/hindsight/hindsight.server";
import type { Industry } from "@/types";

const schema = z.object({
  title: z.string().min(1),
  clientName: z.string().min(1),
  industry: z.string().min(1),
  deadline: z.string().optional(),
  estimatedValue: z.number().optional(),
  content: z.string().min(20),
});

export const Route = createFileRoute("/api/rfp/analyze")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) {
          return Response.json({ error: "Invalid RFP payload" }, { status: 400 });
        }
        const input = parsed.data;
        const analysis = await analyzeRFP({
          title: input.title,
          clientName: input.clientName,
          industry: input.industry as Industry,
          deadline: input.deadline,
          content: input.content,
        });
        let recalled;
        try {
          recalled = await recallMemories({
            industry: input.industry,
            clientName: input.clientName,
            text: `${input.title} ${input.content}`,
            limit: 5,
          });
        } catch (err) {
          if (!(err instanceof HindsightError)) throw err;
          return Response.json(
            { error: `Hindsight recall failed: ${err.message}`, analysis },
            { status: err.status === 503 ? 503 : 502 },
          );
        }
        const recommendation = await reflectOnMemories(analysis, recalled);
        return Response.json({
          analysis,
          recalled,
          recommendation,
          memoryStatus: await getMemoryStatus(),
        });
      },
    },
  },
});
