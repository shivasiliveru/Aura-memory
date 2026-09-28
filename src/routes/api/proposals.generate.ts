import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateProposalSections } from "@/services/ai/generate.server";
import { getMemoryStatus, recallMemories, reflectOnMemories } from "@/services/hindsight/hindsight.server";
import { analyzeRFP } from "@/services/rfp/analyze.server";

const schema = z.object({
  title: z.string().min(1),
  clientName: z.string().min(1),
  industry: z.string().min(1),
  content: z.string().default(""),
  deadline: z.string().optional(),
  useMemory: z.boolean().default(true),
});

export const Route = createFileRoute("/api/proposals/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
        const input = parsed.data;

        const analysis = analyzeRFP({ ...input, industry: input.industry as never });
        const recalled = input.useMemory
          ? await recallMemories({
              industry: input.industry,
              clientName: input.clientName,
              text: `${input.title} ${input.content}`,
              limit: 5,
            })
          : [];
        const recommendation = await reflectOnMemories(analysis, recalled);
        const sections = generateProposalSections({
          title: input.title,
          clientName: input.clientName,
          analysis,
          recommendation,
          useMemory: input.useMemory,
        });

        return Response.json({
          sections,
          recommendation,
          analysis,
          memoryStatus: getMemoryStatus(),
        });
      },
    },
  },
});
