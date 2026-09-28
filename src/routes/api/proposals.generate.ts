import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { generateProposalSections } from "@/services/ai/generate.server";
import {
  HindsightError,
  getMemoryStatus,
  recallMemories,
  reflectOnMemories,
} from "@/services/hindsight/hindsight.server";
import { analyzeRFP } from "@/services/rfp/analyze.server";
import type { AgentRecommendation, Industry, RFPAnalysis } from "@/types";

const schema = z.object({
  title: z.string().min(1),
  clientName: z.string().min(1),
  industry: z.string().min(1),
  content: z.string().default(""),
  deadline: z.string().optional(),
  useMemory: z.boolean().default(true),
  // Results of the analyze step, so generation uses exactly what the user reviewed.
  analysis: z.custom<RFPAnalysis>((v) => !!v && typeof v === "object").optional(),
  recommendation: z.custom<AgentRecommendation>((v) => !!v && typeof v === "object").optional(),
});

export const Route = createFileRoute("/api/proposals/generate")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
        const input = parsed.data;

        const analysis =
          input.analysis ??
          (await analyzeRFP({
            title: input.title,
            clientName: input.clientName,
            industry: input.industry as Industry,
            deadline: input.deadline,
            content: input.content,
          }));

        let recommendation = input.recommendation;
        if (!recommendation) {
          try {
            const recalled = input.useMemory
              ? await recallMemories({
                  industry: input.industry,
                  clientName: input.clientName,
                  text: `${input.title} ${input.content}`,
                  limit: 5,
                })
              : [];
            recommendation = await reflectOnMemories(analysis, recalled);
          } catch (err) {
            if (!(err instanceof HindsightError)) throw err;
            return Response.json(
              { error: `Hindsight recall failed: ${err.message}` },
              { status: err.status === 503 ? 503 : 502 },
            );
          }
        }
        const sections = await generateProposalSections({
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
          memoryStatus: await getMemoryStatus(),
        });
      },
    },
  },
});
