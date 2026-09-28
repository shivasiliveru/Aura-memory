/**
 * Accuracy & robustness evaluation for the Proposal Intelligence agent.
 * ============================================================
 * Read-only: never saves proposals or records outcomes, so it is safe against
 * the live deployment. Uses the same API as the UI.
 *
 *   npx tsx scripts/eval.ts            # all suites
 *   npx tsx scripts/eval.ts --quick    # skip LLM-heavy suites (recall + validation + data only)
 *
 * Suites
 *   1. Recall accuracy     — does Hindsight surface the right past experience first?
 *   2. Input validation    — are bad / non-RFP inputs rejected instead of hallucinated on?
 *   3. Strategy grounding  — do "Why this proposal?" bullets cite real past proposals?
 *   4. Generation quality  — 11 sections, valid citations, lessons actually applied
 *   5. Memory vs baseline  — does memory measurably change the proposal?
 *   6. Stored data quality — duplicates, missing sections, thin memories
 * ============================================================
 */

const BASE_URL = process.env["APP_URL"] || "http://localhost:3000";
const QUICK = process.argv.includes("--quick");

interface Memory {
  id: string;
  title: string;
  industry: string;
  outcome: string;
  clientType: string;
  lessons: string[];
  successfulPatterns: string[];
  failedPatterns: string[];
  relevance?: number;
}
interface Section {
  id: string;
  title: string;
  content: string;
  informedBy: string[];
}

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = "") {
  if (ok) passed++;
  else {
    failed++;
    failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
  }
  console.log(`   ${ok ? "✅" : "❌"} ${name}${detail ? `  (${detail})` : ""}`);
}

// API responses are checked field-by-field below; a loose type keeps the script readable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function api(path: string, body?: unknown): Promise<{ status: number; data: any }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

const lower = (s: string) => s.toLowerCase();
const hasAny = (text: string, words: string[]) => words.some((w) => lower(text).includes(w));

// ─────────────────────────────────────────────────────────────
// 1. Recall accuracy (no LLM cost)
// ─────────────────────────────────────────────────────────────

const RECALL_PROBES = [
  {
    name: "Hospital scheduling + clinician training",
    industry: "Healthcare",
    text: "Hospital needs department-level patient scheduling integrated with Meditech EHR, plus a clinician training plan.",
    expect: ["Clinical Scheduling"],
  },
  {
    name: "Telehealth with HIPAA + Epic",
    industry: "Healthcare",
    text: "Telehealth platform with HIPAA compliance, Epic EHR integration, security architecture and named implementation leads.",
    expect: ["Patient Portal", "Clinical Scheduling"],
  },
  {
    name: "Bank regulatory risk reporting",
    industry: "Banking",
    text: "Bank needs board and regulator risk reporting with core banking integration, audit trail and Basel alignment.",
    expect: ["Enterprise Risk", "Core Banking"],
  },
  {
    name: "Microservice observability migration",
    industry: "SaaS",
    text: "Migrate 300 microservices to OpenTelemetry with zero downtime and per-wave rollback.",
    expect: ["Observability", "Zero-Downtime"],
  },
  {
    name: "Payments PCI + acquirer routing",
    industry: "FinTech",
    text: "Card payments platform needs PCI DSS scope reduction, tokenisation and smart acquirer routing to cut fees.",
    expect: ["Payments Orchestration"],
  },
  {
    name: "Factory predictive maintenance",
    industry: "Manufacturing",
    text: "Plant sensors for predictive maintenance with OT network segmentation and downtime cost modelling.",
    expect: ["Plant-Floor"],
  },
];

async function suiteRecall() {
  console.log("\n1️⃣  Recall accuracy");
  let top1Industry = 0;
  let expectedTop2 = 0;
  for (const probe of RECALL_PROBES) {
    const { status, data } = await api("/api/memory/recall", {
      text: probe.text,
      industry: probe.industry,
      limit: 5,
    });
    if (status !== 200) {
      check(probe.name, false, `HTTP ${status}: ${data?.error ?? ""}`);
      continue;
    }
    const recalled: Memory[] = data.recalled;
    const top = recalled[0];
    const top2 = recalled.slice(0, 2).map((m) => m.title);
    const industryOk = top?.industry === probe.industry;
    const expectOk = top2.some((t) => probe.expect.some((e) => t.includes(e)));
    if (industryOk) top1Industry++;
    if (expectOk) expectedTop2++;
    check(
      `${probe.name}: right experience in top 2`,
      expectOk,
      recalled
        .slice(0, 3)
        .map((m) => `${m.title.split(" — ")[0]} ${Math.round((m.relevance ?? 0) * 100)}%`)
        .join(" | "),
    );
  }
  console.log(
    `   → top-1 same industry: ${top1Industry}/${RECALL_PROBES.length} · expected in top-2: ${expectedTop2}/${RECALL_PROBES.length}`,
  );
}

// ─────────────────────────────────────────────────────────────
// 2. Input validation
// ─────────────────────────────────────────────────────────────

async function suiteValidation() {
  console.log("\n2️⃣  Input validation");
  const base = { title: "Test", clientName: "Test Co", industry: "Healthcare" };

  const tooShort = await api("/api/rfp/analyze", { ...base, content: "short" });
  check("Too-short RFP rejected (400)", tooShort.status === 400, `HTTP ${tooShort.status}`);

  const missing = await api("/api/rfp/analyze", { content: "x".repeat(50) });
  check("Missing title/client rejected (400)", missing.status === 400, `HTTP ${missing.status}`);

  if (QUICK) return;
  const offTopic = await api("/api/rfp/analyze", {
    title: "need advice on headache",
    clientName: "Roshan",
    industry: "Healthcare",
    content: "i got a headache yesterday and a neck pain today, what should i do",
  });
  check(
    "Non-RFP text (personal health question) rejected, not turned into a proposal",
    offTopic.status === 422,
    `HTTP ${offTopic.status}${offTopic.data?.error ? `: ${offTopic.data.error.slice(0, 90)}` : ""}`,
  );
}

// ─────────────────────────────────────────────────────────────
// 3. Strategy grounding + 4. generation quality + 5. memory vs baseline
// ─────────────────────────────────────────────────────────────

const NORTHBAY = {
  title: "Telehealth & Clinical Workflow Modernization",
  clientName: "Northbay Medical Group",
  industry: "Healthcare",
  deadline: "2026-12-15",
  content: `Northbay Medical Group solicits proposals for a Telehealth and Clinical Workflow platform.
Requirements:
- Video consultation, patient scheduling, and clinical note integration.
- HIPAA compliance and SOC 2 Type II certification.
- Integration with existing Epic EHR system.
- Security architecture documentation and penetration testing evidence.
- Phased rollout across 6 clinics over 12 weeks with named implementation leads.
- Per-clinic pricing breakdown and quantified ROI.
Evaluation criteria: Security depth, compliance evidence, implementation specificity, pricing transparency.`,
};

/**
 * Lessons that exist only in memory — the Northbay RFP text never asks for them — so they
 * separate a memory-informed proposal from a baseline one. `section: "*"` searches everything.
 */
const NORTHBAY_LESSONS = [
  {
    lesson: "ROI tied to a measured baseline (Banking losses)",
    section: "ROI / Business Value",
    words: ["baseline"],
  },
  {
    lesson: "Pricing states its assumptions (Banking loss: lump sum)",
    section: "Pricing",
    words: ["assumption"],
  },
  {
    lesson: "Per-phase rollback plan (SaaS loss → win)",
    section: "*",
    words: ["rollback", "roll back", "roll-back"],
  },
  {
    lesson: "Clinician training plan (Riverside loss)",
    section: "*",
    words: ["clinician training", "training plan", "training schedule", "train clinicians"],
  },
  {
    lesson: "Named security lead (St. Jude win)",
    section: "*",
    words: ["security lead", "security officer", "ciso"],
  },
  {
    lesson: "Department/clinic workflow mapping (Riverside loss)",
    section: "*",
    words: [
      "workflow mapping",
      "map each",
      "mapped to each",
      "per-clinic workflow",
      "department workflow",
    ],
  },
];

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

function lessonCoverage(sections: Section[]) {
  return NORTHBAY_LESSONS.map((l) => {
    const text =
      l.section === "*"
        ? sections.map((s) => s.content).join("\n")
        : (sections.find((s) => s.title === l.section)?.content ?? "");
    return { ...l, applied: hasAny(text, l.words) };
  });
}

async function suiteLLM(knownNames: string[], memoryIds: Set<string>) {
  console.log("\n3️⃣  Strategy grounding (Northbay RFP, not saved)");
  const analyzed = await api("/api/rfp/analyze", NORTHBAY);
  if (analyzed.status !== 200) {
    check("Analyze succeeded", false, `HTTP ${analyzed.status}: ${analyzed.data?.error ?? ""}`);
    return;
  }
  const rec = analyzed.data.recommendation;
  check("Strategy produced by Hindsight reflect", rec.source === "hindsight-reflect", rec.source);
  check(
    "Healthcare experience recalled first",
    analyzed.data.recalled[0]?.industry === "Healthcare",
    analyzed.data.recalled[0]?.title,
  );
  const grounded = rec.reasoning.filter((r: string) =>
    knownNames.some((n) => lower(r).includes(lower(n))),
  );
  check(
    "Every 'Why this proposal?' bullet names a real past proposal/client",
    rec.reasoning.length > 0 && grounded.length === rec.reasoning.length,
    `${grounded.length}/${rec.reasoning.length} grounded`,
  );
  for (const r of rec.reasoning.filter((r: string) => !grounded.includes(r))) {
    console.log(`        ungrounded: ${r.slice(0, 140)}`);
  }

  console.log("\n4️⃣  Generation quality (with memory)");
  const withMem = await api("/api/proposals/generate", {
    ...NORTHBAY,
    useMemory: true,
    analysis: analyzed.data.analysis,
    recommendation: rec,
  });
  if (withMem.status !== 200) {
    check("Generate succeeded", false, `HTTP ${withMem.status}`);
    return;
  }
  const sections: Section[] = withMem.data.sections;
  const titles = sections.map((s) => s.title);
  const missing = SECTION_TITLES.filter((t) => !titles.includes(t));
  check(
    "All 11 sections present",
    missing.length === 0,
    missing.length ? `missing: ${missing.join(", ")}` : "11/11",
  );
  check(
    "No thin sections (<150 chars)",
    sections.every((s) => s.content.length >= 150),
  );
  const badCites = sections.flatMap((s) => s.informedBy).filter((id) => !memoryIds.has(id));
  check(
    "Section citations point to real memories",
    badCites.length === 0,
    badCites.length ? `${badCites.length} invalid` : "",
  );
  check(
    "Memory-informed sections cited",
    sections.some((s) => s.informedBy.length > 0),
  );
  const withCov = lessonCoverage(sections);
  for (const l of withCov)
    console.log(`   ${l.applied ? "•" : "○"} memory-only lesson: ${l.lesson}`);

  console.log("\n5️⃣  Memory vs baseline (same RFP, memory off)");
  const baseline = await api("/api/proposals/generate", {
    ...NORTHBAY,
    useMemory: false,
    analysis: analyzed.data.analysis,
    recommendation: { ...rec, basedOn: [], successfulPatterns: [], warnings: [], reasoning: [] },
  });
  if (baseline.status !== 200) {
    check("Baseline generate succeeded", false, `HTTP ${baseline.status}`);
    return;
  }
  const baseCov = lessonCoverage(baseline.data.sections);
  const w = withCov.filter((l) => l.applied).length;
  const b = baseCov.filter((l) => l.applied).length;
  withCov.forEach((l, i) =>
    console.log(
      `   ${l.lesson.padEnd(56)} memory ${l.applied ? "✓" : "·"}   baseline ${baseCov[i]!.applied ? "✓" : "·"}`,
    ),
  );
  console.log(
    `   → memory-only lessons applied: with memory ${w}/${withCov.length} · baseline ${b}/${baseCov.length}`,
  );
  check("Memory applies more memory-only lessons than baseline", w > b, `${w} vs ${b}`);
  check(
    "Memory applies at least half of the memory-only lessons",
    w * 2 >= withCov.length,
    `${w}/${withCov.length}`,
  );
  check(
    "Baseline does not cite memories",
    baseline.data.sections.every((s: Section) => s.informedBy.length === 0),
  );
}

// ─────────────────────────────────────────────────────────────
// 6. Stored data quality (no LLM cost)
// ─────────────────────────────────────────────────────────────

async function suiteData(memories: Memory[]) {
  console.log("\n6️⃣  Stored data quality");
  const { data } = await api("/api/proposals");
  const proposals: { title: string; sections: Section[]; status: string }[] = data.proposals;
  const incomplete = proposals.filter((p) => p.sections.length > 0 && p.sections.length < 11);
  check(
    "Saved proposals have all 11 sections",
    incomplete.length === 0,
    incomplete.map((p) => `${p.title.slice(0, 30)}: ${p.sections.length}`).join("; "),
  );
  check(
    "Every memory has ≥3 lessons",
    memories.every((m) => m.lessons.length >= 3),
  );

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const patterns = memories.flatMap((m) => [...m.successfulPatterns, ...m.failedPatterns]);
  const groups = new Map<string, Set<string>>();
  for (const p of patterns) groups.set(norm(p), (groups.get(norm(p)) ?? new Set()).add(p));
  const dupes = [...groups.values()].filter((g) => g.size > 1).map((g) => [...g].join(" / "));
  check(
    "No near-duplicate patterns (case/spacing variants)",
    dupes.length === 0,
    dupes.slice(0, 3).join("; "),
  );

  const insights = (await api("/api/insights")).data;
  // A label may legitimately appear in both lists (helped one bid, hurt another); check each.
  const merged = [insights.successPatterns, insights.failurePatterns].every(
    (list: { pattern: string }[]) => {
      const keys = list.map((p) => norm(p.pattern));
      return new Set(keys).size === keys.length;
    },
  );
  check("Insights merge duplicate patterns", merged);
}

// ─────────────────────────────────────────────────────────────

async function run() {
  console.log(`🧪 Evaluating ${BASE_URL}${QUICK ? " (quick)" : ""}`);
  const { data } = await api("/api/memory");
  const memories: Memory[] = data.memories;
  console.log(
    `   ${memories.length} memories · Hindsight ${data.status.mode} · storage ${data.storage}`,
  );

  const proposals = (await api("/api/proposals")).data.proposals as { clientName: string }[];
  const knownNames = [
    ...new Set([
      ...memories.flatMap((m) => [m.title.split(" — ")[0]!, m.clientType]),
      ...proposals.map((p) => p.clientName),
    ]),
  ]
    .filter((n) => n && n.length > 3)
    // Short client names ("Meridian", "Halcyon") are how reflect usually refers to them.
    .flatMap((n) => [n, n.split(" ")[0]!])
    .filter((n) => n.length > 4);

  await suiteRecall();
  await suiteValidation();
  if (!QUICK) await suiteLLM(knownNames, new Set(memories.map((m) => m.id)));
  await suiteData(memories);

  console.log(`\n📊 ${passed} passed · ${failed} failed`);
  if (failures.length) {
    console.log("\nFailures:");
    for (const f of failures) console.log(`   · ${f}`);
  }
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error("❌ Eval crashed:", err);
  process.exit(2);
});
