/**
 * Hackathon Demo Seed Script
 * ============================================================
 * Drives the app's real API (the same calls the UI makes), so every experience is
 * analysed by the LLM, retained in Hindsight via the outcome flow, and recalled for real.
 *
 * Background history (gives the dashboard and memory bank realistic depth):
 *   FinTech → WON · SaaS → LOST · Manufacturing → PENDING
 *   Healthcare → LOST · Banking → WON · SaaS → WON (learned from the SaaS loss)
 *
 * The learning-loop scenario shown to judges:
 *   RFP 1: Healthcare (St. Jude)          → WON  → lessons retained
 *   RFP 2: Banking (Pacific National)     → LOST → failure lessons retained
 *   RFP 3: Similar Healthcare (Northbay)  → Hindsight recalls RFP 1 (+ RFP 2 pricing lesson)
 *
 * Run (dev server must be running, with LLM + Hindsight configured):
 *   npx tsx scripts/seed-demo.ts                 # everything, including RFP 3
 *   npx tsx scripts/seed-demo.ts --leave-final   # stop after RFP 2; do RFP 3 live in the UI
 *
 * Tip: use a fresh HINDSIGHT_BANK_ID (e.g. proposal-demo-2) and delete data/store.json
 * for a clean demo.
 * ============================================================
 */

const BASE_URL = process.env["APP_URL"] || "http://localhost:3000";
const LEAVE_FINAL = process.argv.includes("--leave-final");
/** Only add the extra TRAINING experiences (use on an already-seeded deployment). */
const TRAIN_ONLY = process.argv.includes("--train");

interface RecalledMemory {
  id: string;
  title: string;
  industry: string;
  outcome: string;
  relevance: number;
}

interface Recommendation {
  strategy: string;
  reasoning: string[];
  source: string;
  basedOn: RecalledMemory[];
}

interface DemoRFP {
  title: string;
  clientName: string;
  industry: string;
  deadline: string;
  estimatedValue: number;
  content: string;
}

interface DemoOutcome {
  status: "won" | "lost" | "pending";
  successfulFactors?: string[];
  failureFactors?: string[];
  lessons: string;
}

async function post<T = Record<string, unknown>>(path: string, body: unknown): Promise<T> {
  // Retries dropped connections and gateway errors. Every call here is safe to repeat:
  // re-recording an outcome replaces that proposal's memory rather than duplicating it.
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) return (await res.json()) as T;
      const text = await res.text();
      if (res.status < 500 || attempt === 3) {
        throw new Error(`POST ${path} failed (${res.status}): ${text}`);
      }
      console.log(`   ↻ HTTP ${res.status} on ${path}; retrying (${attempt}/2)`);
    } catch (err) {
      const network = err instanceof TypeError; // fetch failed / socket closed
      if (!network || attempt === 3) throw err;
      console.log(`   ↻ connection dropped on ${path}; retrying (${attempt}/2)`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
}

/** Proposals already on the server, by title — lets re-runs resume instead of duplicating. */
async function existingProposals(): Promise<Map<string, { id: string; status: string }>> {
  const res = await fetch(`${BASE_URL}/api/proposals`);
  const { proposals } = (await res.json()) as {
    proposals: { id: string; title: string; status: string }[];
  };
  return new Map(proposals.map((p) => [p.title, { id: p.id, status: p.status }]));
}

/** Analyze → recall → generate → save, exactly as the New RFP wizard does. */
async function runRFP(rfp: DemoRFP) {
  const analyzed = await post<{
    analysis: unknown;
    recalled: RecalledMemory[];
    recommendation: Recommendation;
    memoryStatus: { mode: string; message: string };
  }>("/api/rfp/analyze", rfp);

  if (analyzed.memoryStatus.mode !== "live") {
    throw new Error(`Hindsight is not live: ${analyzed.memoryStatus.message}`);
  }
  console.log(`   ✓ Analyzed. Hindsight recalled ${analyzed.recalled.length} experience(s):`);
  for (const m of analyzed.recalled) {
    console.log(
      `       · ${m.title} [${m.outcome.toUpperCase()}] ${Math.round(m.relevance * 100)}%`,
    );
  }

  const generated = await post<{ sections: unknown[] }>("/api/proposals/generate", {
    title: rfp.title,
    clientName: rfp.clientName,
    industry: rfp.industry,
    content: rfp.content,
    deadline: rfp.deadline,
    useMemory: true,
    analysis: analyzed.analysis,
    recommendation: analyzed.recommendation,
  });

  const saved = await post<{ proposal: { id: string } }>("/api/proposals", {
    title: rfp.title,
    clientName: rfp.clientName,
    industry: rfp.industry,
    value: rfp.estimatedValue,
    rfpContent: rfp.content,
    sections: generated.sections,
    strategy: analyzed.recommendation.strategy,
    analysis: analyzed.analysis,
    recommendation: analyzed.recommendation,
  });
  console.log(`   ✓ Proposal generated and saved: ${saved.proposal.id}`);

  return { id: saved.proposal.id, recalled: analyzed.recalled, rec: analyzed.recommendation };
}

async function recordOutcome(proposalId: string, outcome: DemoOutcome) {
  const res = await post<{ memory: { title: string; lessons: string[]; extractedBy: string } }>(
    `/api/proposals/${proposalId}/outcome`,
    { successfulFactors: [], failureFactors: [], ...outcome },
  );
  // Hindsight indexes a few seconds after retain returns; give it time before the next recall.
  await new Promise((resolve) => setTimeout(resolve, 8000));
  console.log(
    `   ✓ Outcome ${outcome.status.toUpperCase()} retained in Hindsight: "${res.memory.title}" ` +
      `(${res.memory.lessons.length} lessons, extracted by ${res.memory.extractedBy})`,
  );
}

// ─────────────────────────────────────────────────────────────
// Demo data
// ─────────────────────────────────────────────────────────────

const HISTORY: { rfp: DemoRFP; outcome: DemoOutcome }[] = [
  {
    rfp: {
      title: "Payments Orchestration & PCI Modernisation",
      clientName: "Halcyon Payments",
      industry: "FinTech",
      deadline: "2026-06-30",
      estimatedValue: 375000,
      content: `Halcyon Payments seeks a partner to modernise its payments orchestration layer.
Requirements:
- Smart routing across 4 acquirers to cut transaction costs.
- PCI DSS 4.0 scope reduction and tokenisation.
- p99 authorisation latency under 150ms with 99.95% availability SLA.
- Go-live within 5 months with zero disruption to live card traffic.
Evaluation criteria: measurable cost savings, compliance approach, delivery risk, price.`,
    },
    outcome: {
      status: "won",
      successfulFactors: ["Quantified ROI / Payback Model", "Early Compliance Chapter"],
      lessons:
        "The CFO said our payback-period model (7 months, based on their own acquirer fee data) was the deciding factor. " +
        "Mapping PCI scope reduction explicitly per system beat competitors who only claimed compliance.",
    },
  },
  {
    rfp: {
      title: "Observability Platform Migration",
      clientName: "Lumen Cloud",
      industry: "SaaS",
      deadline: "2026-07-20",
      estimatedValue: 260000,
      content: `Lumen Cloud requests proposals to migrate 400 microservices from a legacy monitoring stack to OpenTelemetry.
Requirements:
- Zero-downtime migration with per-wave rollback.
- Unified traces, metrics and logs; SLO dashboards for 30 product teams.
- Cost reduction of at least 25% on observability spend.
Evaluation criteria: technical depth, migration safety, cost model, team experience.`,
    },
    outcome: {
      status: "lost",
      failureFactors: ["Insufficient Technical Detail", "Generic Template Messaging"],
      lessons:
        "Debrief: the engineering panel felt our migration plan was generic — no per-wave rollback design and no service-by-service sequencing. " +
        "The winner showed a detailed cutover runbook. Engineering buyers score architecture depth above everything else.",
    },
  },
  {
    rfp: {
      title: "Plant-Floor IoT Predictive Maintenance",
      clientName: "Forge Industrial",
      industry: "Manufacturing",
      deadline: "2026-10-30",
      estimatedValue: 700000,
      content: `Forge Industrial invites proposals for predictive maintenance across 3 plants.
Requirements:
- Sensor retrofit for 220 critical machines; OT/IT network segmentation.
- Failure prediction with at least 48 hours of warning.
- Downtime cost model per plant and a phased rollout that avoids peak production.
Evaluation criteria: downtime reduction evidence, OT security, rollout plan, total cost.`,
    },
    outcome: {
      status: "pending",
      lessons:
        "Submitted. Early feedback from the plant managers was positive about the per-plant downtime cost model.",
    },
  },
  {
    rfp: {
      title: "Clinical Scheduling & Patient Engagement Suite",
      clientName: "Riverside Community Hospital",
      industry: "Healthcare",
      deadline: "2026-05-15",
      estimatedValue: 310000,
      content: `Riverside Community Hospital seeks a patient engagement and clinical scheduling suite.
Requirements:
- Online booking, reminders and waitlist management across 9 departments.
- HIPAA compliance and integration with the existing Meditech EHR.
- Clinician and front-desk training plan; go-live within 4 months.
Evaluation criteria: clinical workflow fit, adoption plan, compliance, price.`,
    },
    outcome: {
      status: "lost",
      failureFactors: ["Lack of Customization", "Conceptual / Vague Implementation Plan"],
      lessons:
        "Debrief: nursing leadership said we never showed how scheduling would work in their departments, and the training plan was one paragraph. " +
        "The winner mapped each department's workflow and included a clinician training schedule. Healthcare buyers need to see their own clinical reality.",
    },
  },
  {
    rfp: {
      title: "Enterprise Risk Reporting Platform",
      clientName: "Meridian Bank",
      industry: "Banking",
      deadline: "2026-04-30",
      estimatedValue: 910000,
      content: `Meridian Bank requests proposals for an enterprise risk reporting platform.
Requirements:
- Consolidated credit, market and operational risk reporting for the board and regulators.
- Integration with Temenos core banking and the data warehouse; full audit trail.
- Basel III / BCBS 239 alignment evidence.
Evaluation criteria: risk reduction evidence, integration detail, regulatory alignment, total cost.`,
    },
    outcome: {
      status: "won",
      successfulFactors: [
        "Quantified ROI / Payback Model",
        "Technical Depth & Integration Detail",
        "Competitive & Transparent Pricing",
      ],
      lessons:
        "The CRO said we won because risk reduction was quantified in basis points against their own baseline, and the Temenos integration named specific APIs and the audit trail schema. " +
        "Itemised pricing per workstream removed any budget concerns.",
    },
  },
  {
    rfp: {
      title: "Zero-Downtime Cloud Database Migration",
      clientName: "Brightline Analytics",
      industry: "SaaS",
      deadline: "2026-08-10",
      estimatedValue: 420000,
      content: `Brightline Analytics needs to migrate 60 TB of customer data from self-managed Postgres to a managed cloud database.
Requirements:
- Zero downtime for a 24/7 multi-tenant product; tested rollback for each wave.
- SOC 2 evidence and encryption in transit and at rest.
- Completion within 10 weeks.
Evaluation criteria: migration safety, technical depth, timeline realism, cost.`,
    },
    outcome: {
      status: "won",
      successfulFactors: [
        "Technical Depth & Integration Detail",
        "Specific Implementation Timeline",
        "Named Workstream Leads",
      ],
      lessons:
        "The VP Engineering said the per-wave cutover runbook with tested rollback steps was decisive — it directly fixed what cost us the Lumen Cloud bid. " +
        "A week-by-week timeline with named leads made the 10-week deadline credible.",
    },
  },
];

/**
 * Extra training experiences (`--train`): fill coverage gaps — a loss for every industry,
 * a Manufacturing win/loss pair, and a Healthcare win that fixes the Riverside mistake.
 */
const TRAINING: { rfp: DemoRFP; outcome: DemoOutcome }[] = [
  {
    rfp: {
      title: "Real-Time Fraud Detection Engine",
      clientName: "Kestrel Pay",
      industry: "FinTech",
      deadline: "2026-03-20",
      estimatedValue: 290000,
      content: `Kestrel Pay requests proposals for a real-time card fraud detection engine.
Requirements:
- Score 3,000 transactions per second with under 40ms added latency.
- Reduce false declines by at least 20% while holding fraud losses flat.
- Explainable decisions for chargeback disputes; PCI DSS scope unchanged.
Evaluation criteria: evidence of model accuracy, latency guarantees, explainability, commercial terms.`,
    },
    outcome: {
      status: "lost",
      failureFactors: ["Weak ROI Explanation", "Generic Template Messaging"],
      lessons:
        "Debrief: we claimed accuracy gains but showed no benchmark on their data; the winner ran a 2-week proof on a sample of Kestrel's transactions. " +
        "FinTech buyers want evidence — backtests, false-decline rates, latency percentiles — not promises.",
    },
  },
  {
    rfp: {
      title: "Manufacturing Execution System Rollout",
      clientName: "Apex Components",
      industry: "Manufacturing",
      deadline: "2026-02-28",
      estimatedValue: 540000,
      content: `Apex Components seeks an MES rollout across 5 production lines.
Requirements:
- Work-order tracking, quality checkpoints and machine integration (OPC UA).
- No unplanned downtime during rollout; must avoid the Q4 peak season.
- Operator training on every shift and on-site support during go-live.
Evaluation criteria: rollout risk, downtime impact, operator adoption, total cost.`,
    },
    outcome: {
      status: "won",
      successfulFactors: [
        "Specific Implementation Timeline",
        "Customized Workflow Mapping",
        "Quantified ROI / Payback Model",
      ],
      lessons:
        "The plant director said the line-by-line rollout scheduled around peak season, with a downtime cost model per line, won it. " +
        "Shift-by-shift operator training and on-site go-live support addressed their biggest adoption fear.",
    },
  },
  {
    rfp: {
      title: "Supply Chain Visibility Platform",
      clientName: "Norland Steel",
      industry: "Manufacturing",
      deadline: "2026-06-15",
      estimatedValue: 460000,
      content: `Norland Steel requests a supply chain visibility platform linking suppliers, plants and logistics.
Requirements:
- Real-time inventory and shipment tracking across 4 plants and 60 suppliers.
- Integration with SAP and plant-floor systems with OT/IT network segregation.
- Change management for planners and plant staff.
Evaluation criteria: integration approach, OT security, adoption plan, cost.`,
    },
    outcome: {
      status: "lost",
      failureFactors: ["Missing Compliance Evidence", "Conceptual / Vague Implementation Plan"],
      lessons:
        "Debrief: the OT security team scored us lowest — we treated plant-floor integration like IT integration and never addressed network segregation. " +
        "Our change-management section was generic; the winner had a named adoption lead per plant.",
    },
  },
  {
    rfp: {
      title: "Digital Account Opening & KYC",
      clientName: "Harbor Federal Bank",
      industry: "Banking",
      deadline: "2026-07-01",
      estimatedValue: 380000,
      content: `Harbor Federal Bank invites proposals for digital account opening with automated KYC/AML checks.
Requirements:
- Mobile and web onboarding under 8 minutes; identity verification and sanctions screening.
- Integration with the core banking system and existing AML case management.
- FFIEC and BSA/AML compliance evidence; go-live in 6 months.
Evaluation criteria: compliance evidence, time to value, integration detail, price.`,
    },
    outcome: {
      status: "lost",
      failureFactors: ["Missing Compliance Evidence", "Conceptual / Vague Implementation Plan"],
      lessons:
        "Debrief: our 6-month plan left no time for the bank's regulatory review and model validation, so evaluators doubted the timeline. " +
        "We described BSA/AML compliance in general terms instead of mapping each control to evidence.",
    },
  },
  {
    rfp: {
      title: "Laboratory Results & Clinician Workflow Portal",
      clientName: "Cedar Valley Health",
      industry: "Healthcare",
      deadline: "2026-08-30",
      estimatedValue: 360000,
      content: `Cedar Valley Health requests a portal for lab results delivery and clinician result review.
Requirements:
- Results to patients and clinicians within minutes; abnormal-result escalation.
- HIPAA compliance; integration with Epic and the lab information system.
- Clinician adoption across 7 departments with a training plan.
Evaluation criteria: clinical workflow fit, compliance, adoption plan, cost.`,
    },
    outcome: {
      status: "won",
      successfulFactors: [
        "Customized Workflow Mapping",
        "Early Compliance Chapter",
        "Named Workstream Leads",
      ],
      lessons:
        "We applied the Riverside lesson: each department's result-review workflow was mapped with its clinicians before the proposal, and a clinician champion was named per department. " +
        "The CMIO said this was the first proposal that looked like it understood their clinics.",
    },
  },
  {
    rfp: {
      title: "Customer Data Platform Implementation",
      clientName: "Orbit Retail Cloud",
      industry: "SaaS",
      deadline: "2026-09-10",
      estimatedValue: 240000,
      content: `Orbit Retail Cloud needs a customer data platform unifying product, billing and support data.
Requirements:
- Identity resolution across 12 million profiles; real-time audience sync.
- GDPR consent management and data residency in the EU.
- Predictable pricing as data volumes grow.
Evaluation criteria: technical fit, privacy compliance, pricing predictability.`,
    },
    outcome: {
      status: "lost",
      failureFactors: ["Generic Pricing Language", "Competitive & Transparent Pricing"],
      lessons:
        "Debrief: our per-seat pricing surprised the buyer, whose cost driver is profile volume; the winner offered volume-tiered pricing with a cap. " +
        "Pricing must follow the buyer's cost driver and show costs at their projected 3-year volumes.",
    },
  },
];

const RFP1: DemoRFP = {
  title: "Patient Portal & EHR Integration Platform",
  clientName: "St. Jude Health System",
  industry: "Healthcare",
  deadline: "2026-11-15",
  estimatedValue: 650000,
  content: `St. Jude Health System requests proposals for a next-generation Patient Portal and EHR Integration platform.
Key Requirements:
- Patient scheduling, tele-consultation, and lab result visualization.
- Complete HIPAA compliance, SOC 2 Type II certification, and end-to-end data encryption.
- Integration with Epic and Cerner EHR platforms via HL7/FHIR APIs.
- Comprehensive security architecture with zero-trust network access controls.
- Phased deployment across 12 regional facilities over 16 weeks.
- Detailed implementation roadmap with named workstream owners.
Evaluation criteria: Technical architecture depth, compliance rigor, team expertise, pricing transparency, ROI justification.`,
};

const RFP2: DemoRFP = {
  title: "Core Banking Risk Analytics Platform",
  clientName: "Pacific National Bank",
  industry: "Banking",
  deadline: "2026-12-01",
  estimatedValue: 850000,
  content: `Pacific National Bank requests proposals for real-time transaction monitoring, fraud risk scoring and AML compliance.
Requirements:
- 99.99% uptime and sub-50ms scoring latency.
- Integration with the Fiserv core banking platform and a complete audit trail.
- Federal Reserve and FFIEC compliance evidence.
Evaluation criteria: Quantified ROI, technical integration depth, itemised deliverable pricing.`,
};

const RFP3: DemoRFP = {
  title: "Telehealth & Clinical Workflow Modernization",
  clientName: "Northbay Medical Group",
  industry: "Healthcare",
  deadline: "2026-12-15",
  estimatedValue: 480000,
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

// ─────────────────────────────────────────────────────────────

async function run() {
  console.log(`🚀 Seeding Aura Memory demo via ${BASE_URL}\n`);

  if (TRAIN_ONLY) {
    console.log("🎓 Extra training experiences");
    const existing = await existingProposals();
    for (const { rfp, outcome } of TRAINING) {
      console.log(`\n📋 ${rfp.industry}: ${rfp.title} (${rfp.clientName})`);
      const found = existing.get(rfp.title);
      if (found && found.status !== "draft") {
        console.log(`   ⏭  Already trained (${found.status.toUpperCase()}); skipping.`);
        continue;
      }
      // A draft means a previous run saved the proposal but didn't record its outcome.
      const id = found ? found.id : (await runRFP(rfp)).id;
      if (found) console.log(`   ↺ Resuming saved proposal ${id}`);
      await recordOutcome(id, outcome);
    }
    console.log("\n✅ Training experiences retained.");
    return;
  }

  console.log("📚 Background history");
  for (const { rfp, outcome } of HISTORY) {
    console.log(`\n📋 ${rfp.industry}: ${rfp.title} (${rfp.clientName})`);
    const { id } = await runRFP(rfp);
    await recordOutcome(id, outcome);
  }

  console.log("\n\n🎯 Learning-loop scenario");

  console.log(`\n📋 RFP 1 — ${RFP1.industry}: ${RFP1.title}`);
  const p1 = await runRFP(RFP1);
  await recordOutcome(p1.id, {
    status: "won",
    successfulFactors: [
      "Detailed Security Architecture",
      "Early Compliance Chapter",
      "Specific Implementation Timeline",
      "Named Workstream Leads",
    ],
    lessons:
      "The evaluation committee said the HIPAA/SOC 2 security architecture in the first 3 pages set us apart. " +
      "Naming workstream owners with dates per implementation phase scored highest in the technical review.",
  });

  console.log(`\n📋 RFP 2 — ${RFP2.industry}: ${RFP2.title}`);
  const p2 = await runRFP(RFP2);
  await recordOutcome(p2.id, {
    status: "lost",
    failureFactors: [
      "Generic Pricing Language",
      "Weak ROI Explanation",
      "Insufficient Technical Detail",
    ],
    lessons:
      "Pricing was a lump sum with no per-deliverable breakdown — evaluators penalised this. " +
      "ROI was a percentage with no baseline; the winner quantified risk reduction in basis points. " +
      "Fiserv integration was described conceptually instead of naming specific APIs and the audit trail schema.",
  });

  if (LEAVE_FINAL) {
    console.log("\n⏸  --leave-final: run RFP 3 live in the UI (New RFP → load the Northbay text).");
    return;
  }

  console.log(`\n📋 RFP 3 — ${RFP3.industry}: ${RFP3.title}  (the payoff)`);
  const p3 = await runRFP(RFP3);
  const healthcareWin = p3.recalled.some((m) => m.industry === "Healthcare" && m.outcome === "won");
  const pricingLoss = p3.recalled.some((m) => m.outcome === "lost");
  console.log(
    `   ${healthcareWin ? "✅" : "⚠️ "} Recalled the Healthcare WIN (RFP 1): ${healthcareWin}`,
  );
  console.log(`   ${pricingLoss ? "✅" : "ℹ️ "} Recalled a LOSS lesson to avoid: ${pricingLoss}`);
  console.log(`   Strategy (${p3.rec.source}): ${p3.rec.strategy.slice(0, 200)}`);
  for (const r of p3.rec.reasoning.slice(0, 4)) console.log(`     · ${r}`);

  console.log("\n✅ Demo seeded. Open the app → proposal 3 → 'Why this proposal?' sidebar.");
}

run().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
