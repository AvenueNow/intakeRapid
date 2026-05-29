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
| 4 | `app/api/chat/route.ts` — add `updateSchema` tool | ✅ done |
| 5 | `app/api/chat/route.ts` — add `requestNextPackage` tool | ✅ done |
| 6 | `app/api/chat/route.ts` — add `concludeSearch` tool | ✅ done |
| 7 | `app/options/page.tsx` — two-panel layout (chat left, card right) | ✅ done |
| 8 | `app/api/options-chat/route.ts` — full system prompt (modes, narration, inference) | ⬜ not started |
| 9 | `app/api/options-chat/route.ts` — schema summary checkpoint after ~4 packages | ⬜ not started |
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

---

## Next session — start here (Steps 8–11)

### Step 8 — Full system prompt for options-chat

**File:** `app/api/options-chat/route.ts`

Replace the placeholder `SYSTEM_PROMPT` with the full doctrine. Read
`docs/agent-ideology/` first. The prompt must encode:

1. **Three modes** — Collect (schema unknowns > 50%), Narrow (core fields > 70%
   confidence), Confirm (user expressed clear positive intent). Agent should call
   `updateSchema({ agentMode: 'narrow' | 'confirm' })` on transitions.
2. **Narrate every pick** — after `requestNextPackage`, write 1–2 sentences
   explaining the choice: neighborhood, vibe, budget fit. Use the `reason` field
   from the tool output to frame it.
3. **Inference table** — never ask about these; infer from event type:
   - networking / mixer → cocktail-reception, standing, semi-private
   - corporate dinner → seated-dinner, private-room, formality 4
   - birthday party → buyout preferred, fun vibe, DJ likely
   - product launch → AV needs high, standing ok
4. **One question per turn max** — if asking, ask one thing only. Prefer probing
   via package selection over direct questions.
5. **Cold start** — first package (init trigger) shown with low-commitment framing:
   "I don't know much about your event yet — let me start here and we'll refine."
6. **Schema drift** — if a new signal contradicts a high-confidence field
   (confidence > 0.7), surface the contradiction: "You liked that LES space — I
   thought you wanted Williamsburg. Are you open to other neighborhoods?"
7. **Termination** — switch to Confirm when user shows positive intent OR after 7+
   packages with no interest signal (surface a reset question instead).

### Step 9 — Schema summary checkpoint

**File:** `app/api/options-chat/route.ts` (system prompt) + optionally the route

After `packagesShown.length >= 4` in Narrow mode, the agent should surface a
human-readable summary of what it's optimizing for and invite correction:
> "Here's what I'm looking for on your behalf: indoor, Brooklyn, $8k ceiling,
> cocktail reception for ~70 guests, modern vibe. Does that sound right, or has
> anything shifted?"

Implementation options:
A. Pure system prompt instruction — agent counts packages shown from schema and
   decides when to summarize.
B. Add a `summarizeSchema` tool the route calls automatically when
   `packagesShown.length === 4`. Simpler to enforce.

Recommendation: start with A (prompt-only), switch to B if unreliable.

### Step 10 — Schema in emails

**Files:** `app/api/contact/route.ts`, `app/api/update-inquiry/route.ts`

The contact form submission currently sends `{ name, email, phone, summary }`.
Extend to also accept `schema?: EventSchema` from the request body. The options
page should pass the current schema (from sessionStorage) when submitting.

Add a structured event brief section to the internal email (below the contact
info) showing confirmed schema fields: budget ceiling, guest count, space type,
preferred neighborhoods, vibes liked/disliked, etc.

### Step 11 — E2E tests

**File:** `e2e/options-agent.spec.ts` (new)

Seed sessionStorage with a known schema before each test (bypass live AI).
Tests to cover:
- `venuehopperSchema` is read on mount
- clicking "Next" adds the current packageId to `packagesShown`
- clicking "I'm interested" sends a message containing the venue name
- when `tool-concludeSearch` fires (seed via mock), ConfirmCard shows Inquire CTA
- after 4 `packagesShown`, agent text includes the summary checkpoint language

---

## Architecture reference

| File | Role |
|------|------|
| `lib/event-schema.ts` | EventSchema type + factory (Step 1) |
| `lib/schema-session.ts` | sessionStorage helpers (Step 2) |
| `lib/match-parsers.ts` | Budget/location/duration parsing shared utilities |
| `lib/score-packages.ts` | findBestPackage() — DB fetch + scoring, used by both routes |
| `lib/schema-patch.ts` | SchemaPatch type, applyPatch, updateSchemaInputSchema |
| `app/api/match/route.ts` | Dual-path: schema → 1 package, legacy summary → 5 packages |
| `app/api/chat/route.ts` | Intake chat (searchVenues, buildVenueCards, sendSummaryEmail + 3 schema tools) |
| `app/api/options-chat/route.ts` | Options discovery chat (updateSchema, requestNextPackage, concludeSearch) |
| `app/options/page.tsx` | Two-panel: chat left + single package card right |
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
