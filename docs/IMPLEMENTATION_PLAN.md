# Aura Memory — Implementation Plan

## 1. Executive Summary & Existing Project Context

This project is a React 19 + TypeScript web application built using **TanStack Start**, **TanStack Router**, **TanStack Query**, **Vite**, **Tailwind CSS**, and **Shadcn UI**.

### Current Repository Inspection Findings:

- **Frontend Framework**: React 19, Vite, `@tanstack/react-router`, `@tanstack/react-start`, `@tanstack/react-query`.
- **Component Library**: Complete set of 46 Shadcn UI components located in `src/components/ui/` (Card, Button, Dialog, Tabs, Badge, Table, Chart, Form, Select, Textarea, Progress, Switch, Sheet, Accordion, etc.).
- **Server Services**: Pre-structured server-side modules in `src/services/`:
  - `ai/generate.server.ts` — Proposal generation & draft section structuring.
  - `hindsight/hindsight.server.ts` — Memory provider abstraction (recall, retain, reflect).
  - `proposals/store.server.ts` — Seed demo data store with 10 realistic proposals (`p-1` to `p-10`), 10 memories (`m-1` to `m-10`), clients, and workspace metadata.
  - `rfp/analyze.server.ts` — RFP text parsing & structured extraction.
  - `insights/insights.server.ts` — Aggregate win rates and pattern analysis.
- **Server API Layer**: TanStack Start API handlers in `src/routes/api/`:
  - `/api/rfp/analyze`
  - `/api/proposals/generate`
  - `/api/proposals` & `/api/proposals/$id`
  - `/api/proposals/$id/outcome`
  - `/api/memory`, `/api/memory/recall`, `/api/memory/retain`
  - `/api/clients`, `/api/clients/$id`
  - `/api/insights`
- **Current UI**: `src/routes/index.tsx` was a placeholder page.

---

## 2. Target Core Architecture & Product Flow

The central product flow is a continuous memory-learning loop:

```
NEW RFP
   ↓
Analyze RFP (LLM / Structured Extractor)
   ↓
Recall Relevant Memories from Hindsight (RECALL)
   ↓
Reflect on Past Strategies & Lessons (REFLECT)
   ↓
Generate Tailored Proposal with Explanations (LLM + Context)
   ↓
User Reviews & Edits Proposal
   ↓
Record Proposal Outcome (WON / LOST / PENDING + Factors & Lessons)
   ↓
Retain Useful Experience into Hindsight Memory Bank (RETAIN)
   ↓
Future RFPs recall this experience and improve over time
```

---

## 3. Implementation Phases Plan

### Phase 2 — Architecture & Environment Security

- Keep all LLM API keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `ANTHROPIC_API_KEY`, or custom endpoint) and Hindsight API keys (`HINDSIGHT_API_KEY`, `HINDSIGHT_BASE_URL`, `HINDSIGHT_BANK_ID`) strictly on the server side inside `src/services/` and `src/routes/api/`.
- Expose no private credentials to browser client code.
- Provide `.env.example` with standard environment variables.

### Phase 3 — Hindsight Service Integration

- Implement real HTTP client interaction in `src/services/hindsight/hindsight.server.ts` interfacing with Hindsight REST API endpoints (`/banks/:bank_id/retain`, `/banks/:bank_id/recall`, `/reflect` or equivalent standard Hindsight REST endpoints).
- Support dynamic fallback to local-heuristic mode when credentials are missing, cleanly indicating current status (`live` vs `local-heuristic`).
- Implement the core tripartite abstraction:
  - `retainMemory(memory)`
  - `recallMemories(query)`
  - `reflectOnMemories(analysis, recalled)`

### Phase 4 — Memory Domain Design

- Model rich business experience attributes:
  - Industry, Client type, Proposal ID
  - Outcome (`won`, `lost`, `pending`)
  - Key requirements & solution approach
  - Successful factors (e.g., security architecture, compliance, detailed timeline)
  - Failure factors (e.g., generic pricing, weak ROI, vague technical detail)
  - Actionable lessons learned for future proposals.

### Phase 5 — RFP Analysis Engine

- Implement structured RFP parsing accepting pasted text or uploaded documents.
- Extract: Title, Client Name, Industry, Requirements, Technical Needs, Compliance Needs, Timeline, Evaluation Criteria, and Key Keywords.

### Phase 6 — Hindsight Memory Recall

- Query Hindsight memory bank using RFP context (Industry, Client, Technical requirements).
- Retrieve ranked memories with relevance scores and explicit reasons (WHAT happened, WHY it matters, WHAT worked, WHAT failed).

### Phase 7 & 8 — Proposal Generation & Recommendation Explanation

- Connect `generateProposalSections` to an LLM provider (OpenAI / Gemini / Anthropic / Local API) with fallback to structured context generation when API keys are not provided.
- Include actual memory citations in the proposal generation prompt.
- Render "Why the agent recommended this" strategy cards detailing recalled experiences, positive factors to repeat, and negative pitfalls to avoid.

### Phase 9 & 10 — Outcome Recording & Learning Loop Verification

- Implement modal/form for outcome entry (WON, LOST, PENDING).
- Collect structured factors ("What worked" / "What could have been better") and free-text lessons.
- Post outcome to `/api/proposals/$id/outcome` which triggers Hindsight `RETAIN`.
- Verify end-to-end learning loop: Retained lessons from Proposal A are recalled in Proposal B and shape its generated strategy.

### Phase 11 — Persistence & Demo Data

- Enhance `store.server.ts` with persistent disk storage (JSON/SQLite or file-backed database) to ensure proposals, outcomes, and client records persist across app restarts.
- Preserve 10 realistic demo proposals and memories across 5 diverse industries (Healthcare, Banking, FinTech, SaaS, Manufacturing).

### Phase 12 & 13 — UI Dashboard & Memory Views Integration

- Complete the full frontend application UI in `src/routes/index.tsx` and subviews using existing Shadcn components.
- Build views:
  1. **Dashboard Overview**: Metrics (Total proposals, Win rate, Active RFPs, Memories learned), Recent Proposals table, Insight highlights.
  2. **New RFP Workflow Wizard**: RFP Input -> Real-time RFP Analysis -> Hindsight Memory Recall -> AI Proposal Generation.
  3. **Proposal Editor & Intelligence View**: Interactive section editor, RFP summary, "Why the agent recommended this" rationale, Recalled memories list, Outcome recorder modal.
  4. **Memory Bank Viewer**: Search & filter retained Hindsight memories, showing outcome badges, successful/failed patterns, and lessons.
  5. **Insights & Analytics**: Win rates by industry, top success factors, failure pitfalls, learning trends over time.

### Phase 14 & 15 — Error Handling & Security Audit

- Graceful user notifications for network/API failures.
- Check for exposed keys, ensure `.gitignore` guards `.env`.

### Phase 16, 17, 18, 19, 20 — Automated Testing, Documentation, Verification & Final Report

- Add automated unit tests covering RFP analysis, memory recall, proposal generation, outcome recording, and memory retain.
- Update `README.md` and create `/docs/HINDSIGHT_ARCHITECTURE.md`.
- Perform type check (`tsc --noEmit`), build verification (`npm run build`), and deliver detailed final report.
