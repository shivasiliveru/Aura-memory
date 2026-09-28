import type { Insight, InsightsPayload } from "@/types";
import { memories, proposals } from "@/services/proposals/store.server";

export function buildInsights(): InsightsPayload {
  const byIndustry = new Map<string, { won: number; lost: number }>();
  for (const p of proposals) {
    if (p.status !== "won" && p.status !== "lost") continue;
    const entry = byIndustry.get(p.industry) ?? { won: 0, lost: 0 };
    entry[p.status] += 1;
    byIndustry.set(p.industry, entry);
  }

  const winRateByIndustry = Array.from(byIndustry.entries()).map(([industry, v]) => ({
    industry,
    won: v.won,
    lost: v.lost,
    winRate: Math.round((v.won / Math.max(1, v.won + v.lost)) * 100),
  }));

  const successPatterns = tally(memories.flatMap((m) => m.successfulPatterns));
  const failurePatterns = tally(memories.flatMap((m) => m.failedPatterns));

  const insights: Insight[] = [
    ...successPatterns.slice(0, 2).map<Insight>((p, i) => ({
      id: `s-${i}`,
      label: `${p.pattern} strengthens proposals`,
      detail: `${p.pattern} appears in ${p.count} successful experience${p.count === 1 ? "" : "s"}.`,
      tone: "positive",
      occurrences: p.count,
    })),
    ...failurePatterns.slice(0, 2).map<Insight>((p, i) => ({
      id: `f-${i}`,
      label: `${p.pattern} weakens proposals`,
      detail: `${p.pattern} contributed to ${p.count} unsuccessful outcome${p.count === 1 ? "" : "s"}.`,
      tone: "negative",
      occurrences: p.count,
    })),
  ];

  return { winRateByIndustry, successPatterns, failurePatterns, insights };
}

function tally(values: string[]) {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return Array.from(counts.entries())
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count);
}
