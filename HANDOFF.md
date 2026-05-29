# Agentic Options Rewrite — VenueHopper

**Started:** 2026-05-29
**Production URL:** https://intake-rapid.vercel.app
**Repo:** https://github.com/AvenueNow/intakeRapid.git (branch: `main`)

Design decisions are documented in `docs/agent-ideology/`.

---

## What we're building

Replacing the flat list of venue cards on `/options` with a one-at-a-time,
schema-driven agentic experience. The agent shows one package, reads the user's
reaction, updates its internal model of the event, and picks the next package
strategically. Packages are probes, not answers.

Full concept: `docs/agent-ideology/README.md`

---

## Implementation plan

| Step | File(s) | Status |
|------|---------|--------|
| 1 | `lib/event-schema.ts` — EventSchema type + `createEmptySchema()` | ✅ done |
| 2 | `lib/schema-session.ts` — `saveSchema` / `loadSchema` helpers | ✅ done |
| 3 | `app/api/match/route.ts` — accept schema, return 1 package + reason | ✅ done |
| 4 | `app/api/chat/route.ts` — add `updateSchema` tool | ⬜ not started |
| 5 | `app/api/chat/route.ts` — add `requestNextPackage` tool | ⬜ not started |
| 6 | `app/api/chat/route.ts` — add `concludeSearch` tool | ⬜ not started |
| 7 | `app/options/page.tsx` — two-panel layout (chat left, card right) | ⬜ not started |
| 8 | `app/api/chat/route.ts` — update system prompt (modes, narration, inference) | ⬜ not started |
| 9 | agent system prompt — schema summary checkpoint after ~4 packages | ⬜ not started |
| 10 | `app/api/contact/route.ts`, `app/api/update-inquiry/route.ts` — schema in emails | ⬜ not started |
| 11 | `e2e/options-agent.spec.ts` — new e2e tests for agent flow | ⬜ not started |

---

## Step details

### Step 1 — `lib/event-schema.ts`
TypeScript interface + `createEmptySchema()`. No logic — just the contract.
Confidence-weighted fields: `{ value, confidence: 0–1, source: 'stated' | 'inferred' | 'probe' }`.
See `docs/agent-ideology/event-schema.md` for field list.

### Step 2 — `lib/schema-session.ts`
`saveSchema(schema: EventSchema): void` → `sessionStorage('venuehopperSchema')`
`loadSchema(): EventSchema | null` → parse or return null

### Step 3 — `/api/match` rewrite
- **In:** `{ schema: EventSchema }` (packagesShown inside schema — no separate param)
- **Out:** `{ package: MatchedPackage | null, reason: string }`
- Scoring: hard-filter dealbreakers + capacity. Score by constraint fit + information gain on low-confidence fields. Return only the top 1.

### Step 4 — `updateSchema` tool
Agent calls this after reading each user message. Takes `Partial<EventSchema>`.
Returns merged schema. Client receives it via tool output and saves to sessionStorage.

### Step 5 — `requestNextPackage` tool
Agent calls when it wants to show a package. Internally calls `/api/match` with
current schema. Returns `{ package, reason }`. Agent uses `reason` in its framing.

### Step 6 — `concludeSearch` tool
Agent calls when shifting to Confirm mode. Takes `{ packageId, agentSummary }`.
UI uses this to show the inquiry CTA.

### Step 7 — `/options` page split layout
- Left: `useChat` chat thread (agent conversation)
- Right: single package card updated by `requestNextPackage` tool output
- "Tell me more" → sends structured message back to agent
- "Not for me" → sends rejection + packageId, agent follows up

### Step 8 — system prompt update
Encode: three modes + transitions, narrate-your-choice instruction, inference table
(event type → implied fields), one-question-per-turn rule, cold start framing,
schema drift handling, termination signals.

### Step 9 — schema summary checkpoint
After ~4 packages in Narrow mode, agent surfaces human-readable schema summary
and invites correction. Driven by `packagesShown.length` in the schema.

### Step 10 — schema in emails
Contact and update-inquiry emails include structured event brief (schema fields +
finalist package), not just chat transcript.

### Step 11 — e2e tests
Cover: schema persistence, "Not for me" follow-up, packagesShown increment,
concludeSearch CTA, schema summary checkpoint at ~4 packages.

---

## Architecture reference

| File | Role |
|------|------|
| `lib/event-schema.ts` | EventSchema type + factory (Step 1) |
| `lib/schema-session.ts` | sessionStorage helpers (Step 2) |
| `app/api/match/route.ts` | Returns 1 package scored against schema (Step 3) |
| `app/api/chat/route.ts` | Agent tools: updateSchema, requestNextPackage, concludeSearch |
| `app/options/page.tsx` | Two-panel: chat + single card |
| `docs/agent-ideology/` | Design decisions — read before changing agent behavior |

## Key sessionStorage keys
- `venuehopperSummary` — event summary JSON (from intake chat)
- `venuehopperUnlocked` — `"1"` when contact form submitted
- `venuehopperSchema` — EventSchema JSON (new — set during options session)

## Env vars
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`
- `SUPABASE_URL` — `https://xpwplhvvtnrmdxsvzfho.supabase.co`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — optional

## Commands
```bash
npm run dev
npm run build
npm run test:e2e
```
