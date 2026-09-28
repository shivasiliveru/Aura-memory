# Aura Memory — AI Proposal & RFP Agent

An AI-powered proposal generation platform that **learns from every outcome**. Built with TanStack Start, React 19, TypeScript, and integrated with a real LLM and the [Hindsight](https://github.com/vectorize-io/hindsight) long-term memory system.

---

## What It Does

```
New RFP
  → Analyze RFP with LLM
  → Recall relevant past proposals from Hindsight memory
  → Generate tailored proposal using RFP + analysis + recalled experience
  → Display proposal with "Why this strategy" sidebar
  → Record outcome (Won / Lost / Pending)
  → Retain lessons in Hindsight
  → Next similar RFP → Hindsight recalls previous experience → better proposal
```

The system genuinely improves with every proposal. A healthcare RFP marked **WON** teaches the agent what language, structure and evidence to repeat. A banking proposal marked **LOST** teaches it what to avoid.

---

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values. At minimum, set an LLM key:

```env
LLM_PROVIDER=openai
LLM_API_KEY=sk-...your-openai-key...
LLM_MODEL=gpt-4o
```

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Required Credentials

| Variable             | Required                              | Description                                                          |
| -------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| `LLM_API_KEY`        | **Yes**                               | OpenAI, Gemini, Anthropic, or compatible key                         |
| `LLM_PROVIDER`       | No (default: `openai`)                | `openai` / `gemini` / `anthropic` / `custom`                         |
| `LLM_MODEL`          | No                                    | Defaults to `gpt-4o`, `gemini-1.5-pro`, `claude-3-5-sonnet-20241022` |
| `LLM_BASE_URL`       | No                                    | Only for custom endpoints (Groq, Ollama, etc.)                       |
| `HINDSIGHT_API_KEY`  | **Yes**                               | Hindsight Cloud API key                                              |
| `HINDSIGHT_BASE_URL` | No (default: Hindsight Cloud)         | `https://api.hindsight.vectorize.io`, or a self-hosted server URL    |
| `HINDSIGHT_BANK_ID`  | No (default: `proposal-intelligence`) | Memory bank name                                                     |
| `APP_DATA_PATH`      | No (default: `./data/store.json`)     | Path for persistent JSON store                                       |

> **Hindsight is required.** There is no simulated memory: if Hindsight is not configured or unreachable, analyze/generate/outcome return a clear error instead of fake recall.

---

## Hindsight Memory (Required)

The app uses [Hindsight Cloud](https://docs.hindsight.vectorize.io/). Create an API key in the Hindsight Cloud UI, then add to `.env`:

```env
HINDSIGHT_API_KEY=hsk_...
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
HINDSIGHT_BANK_ID=proposal-intelligence
```

The bank is created automatically on first use, with retain/reflect missions tuned for proposal outcomes. Calls used:

| Operation | Endpoint                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------- |
| Retain    | `POST /v1/default/banks/{bank}/memories` (one document per proposal, tagged by industry and outcome) |
| Recall    | `POST /v1/default/banks/{bank}/memories/recall`                                                      |
| Reflect   | `POST /v1/default/banks/{bank}/reflect` (structured strategy + "why" bullets)                        |

## LLM Provider Examples

**OpenAI (recommended):**

```env
LLM_PROVIDER=openai
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o
```

**Google Gemini:**

```env
LLM_PROVIDER=gemini
LLM_API_KEY=AIza...
LLM_MODEL=gemini-1.5-pro
```

**Anthropic Claude:**

```env
LLM_PROVIDER=anthropic
LLM_API_KEY=sk-ant-...
LLM_MODEL=claude-3-5-sonnet-20241022
```

**Groq (fast inference):**

```env
LLM_PROVIDER=custom
LLM_API_KEY=gsk_...
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=openai/gpt-oss-120b
```

---

## Testing the Hindsight Learning Loop

### Option A: Manual flow (5 minutes)

1. Click **New RFP** → load the **Healthcare** sample → **Analyze & Recall**
2. Review recalled memories + agent strategy → **Generate Proposal**
3. Save & open → click **Record Outcome / Retain Memory** → select **WON**
4. Check ✅ factors → add lesson text → **Save Outcome & Retain Memory**
5. Click **New RFP** again → load same Healthcare sample → **Analyze & Recall**
6. Observe: the memory you just retained appears in the **Hindsight Memory Recall** card
7. The generated proposal now references your lesson

### Option B: Automated hackathon demo seed

Start the dev server, then run:

```bash
npx tsx scripts/seed-demo.ts
```

This seeds the complete 3-RFP demo scenario:

- **RFP 1**: Healthcare (St. Jude) → WON → lesson retained
- **RFP 2**: Banking (Pacific National) → LOST → failure reason retained
- **RFP 3**: Similar Healthcare (Northbay) → Hindsight recalls RFP 1 → improved proposal

Refresh the app to see all proposals in the dashboard with the recalled memories visible in each proposal detail sidebar.

---

## Deploy to Vercel

1. **Import the repo** in Vercel (New Project → select this GitHub repo). `vercel.json` already sets the build command (`npm run build:vercel`, the Nitro `vercel` preset). Leave the framework preset as detected.
2. **Add storage:** Project → Storage → Marketplace → **Upstash Redis** → create (free tier) and connect it to the project. This sets `KV_REST_API_URL` / `KV_REST_API_TOKEN` automatically. Serverless functions have no lasting disk, so proposals, outcomes and the memory mirror live here.
3. **Add environment variables** (Project → Settings → Environment Variables):

   | Variable             | Value                                                           |
   | -------------------- | --------------------------------------------------------------- |
   | `LLM_PROVIDER`       | `custom`                                                        |
   | `LLM_BASE_URL`       | `https://api.groq.com/openai/v1`                                |
   | `LLM_MODEL`          | `openai/gpt-oss-120b`                                           |
   | `LLM_API_KEY`        | your Groq key                                                   |
   | `LLM_FALLBACK_MODEL` | `openai/gpt-oss-20b` (used when the main model is rate-limited) |
   | `HINDSIGHT_API_KEY`  | your Hindsight Cloud key                                        |
   | `HINDSIGHT_BASE_URL` | `https://api.hindsight.vectorize.io`                            |
   | `HINDSIGHT_BANK_ID`  | e.g. `proposal-intelligence`                                    |

4. **Deploy**, then seed the demo against the live URL:

   ```bash
   APP_URL=https://your-app.vercel.app npx tsx scripts/seed-demo.ts
   ```

> The Groq free tier allows 8k tokens/minute and 200k tokens/day per model (about 10 full proposal cycles). The app waits and retries on short limits, and switches to `LLM_FALLBACK_MODEL` when the main model is exhausted. The full seed takes ~4-8 minutes.

### Other targets

- `npm run build:node && npm start` — plain Node server (uses `./data/store.json`, or Redis if the `KV_*` vars are set).
- `npm run build` — the default Lovable / Cloudflare build.

## Project Structure

```
src/
├── routes/
│   ├── index.tsx                  # Main app shell (tab routing)
│   └── api/
│       ├── rfp.analyze.ts         # POST /api/rfp/analyze
│       ├── proposals.generate.ts  # POST /api/proposals/generate
│       ├── proposals.ts           # GET/POST /api/proposals
│       ├── proposals.$id.ts       # GET/PATCH /api/proposals/:id
│       ├── proposals.$id.outcome.ts  # POST /api/proposals/:id/outcome
│       ├── proposals.refine-section.ts # POST /api/proposals/refine-section
│       ├── memory.ts              # GET /api/memory
│       ├── memory.retain.ts       # POST /api/memory/retain
│       ├── memory.recall.ts       # POST /api/memory/recall
│       ├── insights.ts            # GET /api/insights
│       └── clients.ts             # GET /api/clients
├── services/
│   ├── ai/
│   │   ├── llm.server.ts          # Multi-provider LLM client
│   │   └── generate.server.ts     # Proposal generation + section refinement
│   ├── hindsight/
│   │   └── hindsight.server.ts    # Hindsight Cloud retain/recall/reflect
│   ├── rfp/
│   │   └── analyze.server.ts      # RFP structured extraction
│   └── proposals/
│       └── store.server.ts        # Persistent JSON store (proposals, clients, memories)
├── components/proposal-intelligence/
│   ├── NewRFPWizard.tsx           # 3-step wizard: Input → Recall → Generate
│   ├── ProposalDetailView.tsx     # Proposal editor + memory sidebar
│   ├── OutcomeModal.tsx           # Won/Lost/Pending + Hindsight retain
│   ├── MemoryBankView.tsx         # Memory bank browser
│   ├── InsightsView.tsx           # Win-rate analytics + pattern insights
│   └── DashboardView.tsx          # Proposal dashboard
└── types/index.ts                 # Shared TypeScript types
```

---

## Architecture

```
Browser
  │
  ├── NewRFPWizard → POST /api/rfp/analyze
  │     └── analyzeRFP()     ← LLM structured extraction
  │     └── recallMemories() ← Hindsight recall
  │     └── reflectOnMemories() ← Hindsight reflect (LLM over recalled memories if reflect fails)
  │
  ├── NewRFPWizard → POST /api/proposals/generate
  │     └── recallMemories() ← fresh recall
  │     └── reflectOnMemories()
  │     └── generateProposalSections() ← LLM with memory context
  │
  └── ProposalDetailView → POST /api/proposals/:id/outcome
        └── retainMemory() ← Hindsight retain (then mirrored locally for the Memory Bank list)
```

---

## Key Design Decisions

- **Hindsight is the memory layer.** Recall and retain always go to Hindsight; failures are shown to the user, never replaced with simulated memory.
- **All secrets are server-side only.** LLM API keys and Hindsight config are read from `process.env` in `.server.ts` files. No credentials ever reach the browser bundle.
- **Local persistence.** All proposals, clients, outcomes and memories are written to `./data/store.json` on every mutation. The store is loaded at server startup — you lose nothing across restarts.
- **Memory informs generation.** The LLM prompt explicitly contains recalled memory content, not just IDs. The model is instructed to apply lessons, not merely display them.

---

## Memory — What Gets Stored

When you mark a proposal **Won** or **Lost**, the following is retained in Hindsight:

| Field               | Example                                                           |
| ------------------- | ----------------------------------------------------------------- |
| Title               | "St. Jude EHR Platform — Won"                                     |
| Industry            | Healthcare                                                        |
| Client type         | Hospital network                                                  |
| Outcome             | won / lost                                                        |
| Full lesson text    | "Named security lead + compliance section in first 3 pages..."    |
| Successful patterns | ["Security detail", "Named leads", "Quantified ROI"]              |
| Failed patterns     | ["Generic pricing", "Vague ROI"]                                  |
| Lessons             | ["Compliance must be page 1-3", "Per-facility pricing breakdown"] |

All of this is indexed semantically by Hindsight and recalled for future RFPs with similar industry, requirements, and keywords.
