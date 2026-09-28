/**
 * Fills in missing sections on saved proposals (generated before sections were enforced).
 * Existing sections are kept as-is; only the missing ones are generated, using the
 * proposal's saved analysis and memory snapshot. Idempotent.
 *
 *   APP_URL=https://your-app.vercel.app npx tsx scripts/repair-sections.ts
 */

const BASE_URL = process.env["APP_URL"] || "http://localhost:3000";

const SECTION_TITLES = [
  "Executive Summary",
  "Understanding of Requirements",
  "Proposed Solution",
  "Technical Approach",
  "Security & Compliance",
  "Implementation Plan",
  "Timeline",
  "Team",
  "Pricing",
  "ROI / Business Value",
  "Conclusion",
];

interface Section {
  id: string;
  title: string;
  content: string;
  informedBy: string[];
}

async function api<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`${method} ${path} failed (${res.status}): ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function run() {
  const { proposals } = await api<{
    proposals: {
      id: string;
      title: string;
      clientName: string;
      industry: string;
      rfpContent: string;
      sections: Section[];
      analysis?: unknown;
      recommendation?: { basedOn: unknown[] };
    }[];
  }>("/api/proposals");

  const incomplete = proposals.filter(
    (p) =>
      p.sections.length > 0 && SECTION_TITLES.some((t) => !p.sections.some((s) => s.title === t)),
  );
  console.log(`🔧 ${incomplete.length} proposal(s) with missing sections on ${BASE_URL}`);

  for (const p of incomplete) {
    const missing = SECTION_TITLES.filter((t) => !p.sections.some((s) => s.title === t));
    console.log(`\n📋 ${p.title} — missing: ${missing.join(", ")}`);
    if (!p.analysis || !p.recommendation) {
      console.log("   ⚠️  No saved analysis/recommendation; skipping.");
      continue;
    }
    const generated = await api<{ sections: Section[] }>("/api/proposals/generate", "POST", {
      title: p.title,
      clientName: p.clientName,
      industry: p.industry,
      content: p.rfpContent,
      useMemory: p.recommendation.basedOn.length > 0,
      analysis: p.analysis,
      recommendation: p.recommendation,
    });
    const merged = SECTION_TITLES.map(
      (t) => p.sections.find((s) => s.title === t) ?? generated.sections.find((s) => s.title === t),
    ).filter((s): s is Section => !!s);
    await api(`/api/proposals/${p.id}`, "PATCH", { sections: merged });
    console.log(`   ✓ Now ${merged.length}/11 sections`);
  }
}

run().catch((err) => {
  console.error("❌ Repair failed:", err.message);
  process.exit(1);
});
