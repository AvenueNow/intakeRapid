# Testing Handoff — VenueHopper Intake Form

**Date:** 2026-05-28
**Production URL:** https://intake-rapid1.vercel.app
**Repo:** https://github.com/AvenueNow/intakeRapid.git (branch: `main`)

---

## What was built this session

### 1. Venue matching (`/api/match`)
POST endpoint that takes the event summary from sessionStorage and returns up to 5 ranked venue packages from Supabase. Scoring: neighborhood match (+30), budget fit (+20/+10 bonus), duration fit (+10), has photo (+2). Hard filter: capacity must fit guest count.

### 2. Options page (`/options`)
Dynamically renders venue cards (photo, name, neighborhood, package, price, capacity, duration, Inquire mailto CTA). Falls back to "Give us 24 hours" holding page if no summary or no matches.

### 3. Inline venue cards in chat (`/`)
AI now searches immediately after getting basic info (no longer gates behind 8 required fields). Each `searchVenues` call produces a scrollable row of compact venue cards (with photos) directly in the chat. Users can refine conversationally — each refinement shows a fresh row of cards.

### 4. Playwright e2e tests (`e2e/flow.spec.ts`)
6 tests covering the full flow using sessionStorage seeding to bypass live AI.

---

## Run the tests

```bash
cd "/Users/rockstonepebble/Intake form/intake-form"
npm run dev                  # must be running first
npm run test:e2e             # run all 6 tests headless
npm run test:e2e:ui          # visual browser UI — good for debugging
```

All 6 should pass in ~4 seconds.

---

## Manual testing checklist

### Chat → inline cards
- [ ] Open https://intake-rapid1.vercel.app
- [ ] Type something minimal: "networking event, ~50 people, Midtown"
- [ ] AI should respond + show a scrollable row of venue cards with photos
- [ ] Reply with a refinement: "actually let's try SoHo"
- [ ] A **new** row of cards should appear (old row stays in history)
- [ ] Try another: "budget is around $3k" → new cards again
- [ ] "Inquire →" button on a card opens a pre-filled mailto

### Confirmation + unlock
- [ ] Keep chatting until AI offers to save options
- [ ] After `sendSummaryEmail` fires, page redirects to `/confirmation` after ~2 seconds
- [ ] Confirmation shows blurred summary + contact form (Name, Email required, Phone optional)
- [ ] Fill form → click "Unlock My Summary →" → summary unlocks
- [ ] "See venue options →" button appears

### Options page
- [ ] Click "See venue options →" → `/options` loads
- [ ] Venue cards appear (should match event profile from chat)
- [ ] "← Back to my summary" returns to unlocked `/confirmation`

### Edge cases
- [ ] Navigate directly to `/options` with no prior chat → holding page ("Give us 24 hours") should show
- [ ] Large guest count (200+) → fewer cards but should still show some
- [ ] Location not in NYC (e.g. "Brooklyn") → may get 0 results → holding page

---

## Known issues / things to verify

| Issue | Status |
|-------|--------|
| Supabase env vars added to Vercel 50m before session end — first deployment with them live | Verify cards appear on production |
| 5 DB neighborhoods were missing from alias map (Greenwich Village, West Village, Kips Bay, Murray Hill, Upper West Side) | Fixed in this session |
| `searchVenues` budget filter is strict (exact `lte`) — AI may get fewer results than `/options` which soft-scores | Known, acceptable for now |
| Inline card photos depend on space_photos RLS — anon can view if venue is active | Verified working |

---

## Architecture quick reference

| File | Role |
|------|------|
| `app/page.tsx` | Chat UI — renders messages + inline venue cards from `tool-searchVenues` output |
| `app/api/chat/route.ts` | Streaming chat handler — `searchVenues` tool (Supabase queries + photos) + `sendSummaryEmail` tool |
| `app/api/match/route.ts` | POST endpoint — takes summary JSON, returns ranked venue packages with photos |
| `app/confirmation/page.tsx` | Locked/unlocked summary + contact form |
| `app/options/page.tsx` | Full venue cards page — reads sessionStorage, calls `/api/match` |
| `e2e/flow.spec.ts` | Playwright tests — seeds sessionStorage, bypasses AI |

## Key sessionStorage keys
- `venuehopperSummary` — JSON of event details (set when `sendSummaryEmail` fires, also updated on edit)
- `venuehopperUnlocked` — `"1"` when contact form has been submitted

## Env vars (all set in Vercel)
- `ANTHROPIC_API_KEY`
- `RESEND_API_KEY`
- `SUPABASE_URL` — `https://xpwplhvvtnrmdxsvzfho.supabase.co`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — optional, hides Google sign-in button if unset
