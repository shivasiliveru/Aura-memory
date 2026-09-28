import { createFileRoute } from "@tanstack/react-router";
import { memories, storeBackend } from "@/services/proposals/store.server";
import { getMemoryStatus } from "@/services/hindsight/hindsight.server";

export const Route = createFileRoute("/api/memory")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          memories: [...memories].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
          status: await getMemoryStatus(),
          storage: storeBackend(),
        }),
    },
  },
});
