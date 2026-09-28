import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { refineSection } from "@/services/ai/generate.server";

const schema = z.object({
  sectionTitle: z.string().min(1),
  content: z.string().min(1),
  action: z.enum(["regenerate", "improve", "shorter", "persuasive", "detail"]),
  instruction: z.string().optional(),
});

export const Route = createFileRoute("/api/proposals/refine-section")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = schema.safeParse(await request.json());
        if (!parsed.success) {
          return Response.json({ error: "Invalid request" }, { status: 400 });
        }
        try {
          const content = await refineSection(
            parsed.data.sectionTitle,
            parsed.data.content,
            parsed.data.action,
            parsed.data.instruction,
          );
          return Response.json({ content });
        } catch (err) {
          return Response.json(
            { error: err instanceof Error ? err.message : "Refinement failed" },
            { status: 500 },
          );
        }
      },
    },
  },
});
