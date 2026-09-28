import { createFileRoute } from "@tanstack/react-router";
import { buildInsights } from "@/services/insights/insights.server";

export const Route = createFileRoute("/api/insights")({
  server: {
    handlers: {
      GET: async () => Response.json(buildInsights()),
    },
  },
});
