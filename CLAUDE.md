@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

VenueHopper event intake form — a chat-based AI assistant that helps event organizers find venues in New York City. Collects event planning details, then gates the summary behind a contact form, and emails everything to `events@venuehopper.com` via Resend.

Next.js App Router, AI SDK v6, TypeScript, Tailwind, Vercel Analytics.

**Production URL:** `https://intake-rapid.vercel.app`

## Git workflow

**Always commit and push to `origin main` after making changes.** The repo is at `https://github.com/AvenueNow/intakeRapid.git` and is connected to Vercel — every push triggers a redeploy.

```bash
git add <files>
git commit -m "descriptive message"
git push origin main
```

## Commands

```bash
npm run dev      # start dev server on localhost:3000
npm run build    # production build
npm run lint     # ESLint
npm run test:e2e # Playwright e2e tests (runs against localhost:3000, auto-starts dev server)
```

## Testing

Playwright e2e tests live in `e2e/flow.spec.ts`. **Always run `npm run test:e2e` after any UI or API changes** and fix failures before pushing. Tests auto-start the dev server. Screenshots are saved to `test-results/screenshots/` (gitignored).

The test suite covers: chat layout, confirmation locked/unlocked, options page venue cards + save buttons + sticky bar, event page (public/owner/rename/share), and login flow. When adding new UI, add corresponding tests.

## Environment variables

- `ANTHROPIC_API_KEY` — Claude API key
- `RESEND_API_KEY` — Resend API key
- `SUPABASE_URL` — Supabase project URL (server-side only, used by `/api/match`)
- `SUPABASE_ANON_KEY` — Supabase anon JWT (server-side only, used by `/api/match`)
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — Google OAuth client ID (enables Google sign-in on the confirmation page; optional, button is hidden if unset)

## Full user flow

1. User lands on `/` — chat UI with a static welcome message
2. AI collects: availability, location (NYC neighborhood), budget, event type, agenda, duration, dietary restrictions, guest count
   - Agent makes smart assumptions from event type (networking → standing, corporate dinner → private room) and infers silently rather than asking
   - Does NOT ask for name/contact info — collected later via the confirmation form
   - Before wrapping up, asks exactly: "Great, I have what I need to get a few options for you. Anything else I'm missing?"
3. AI calls `sendSummaryEmail` tool → email sent to events@venuehopper.com (readable chat transcript) → 2-second delay → redirect to `/confirmation`
4. `/confirmation` shows blurred summary + contact form (name, email, phone optional) side by side
   - Contact form offers **Google sign-in** (via GIS) to pre-fill name + email
   - Unlocked state is persisted in `sessionStorage('venuehopperUnlocked')` so returning from `/options` stays unlocked
5. User submits contact form → `POST /api/contact` emails events@venuehopper.com **and** sends a confirmation email to the user → summary unlocks
6. User can click **Edit** on the revealed summary → inline edit mode → `POST /api/update-inquiry` re-emails updated summary + contact
7. Unlocked page shows **"See venue options →"** button → `/options` — dynamically matched venues from Supabase
   - `/options` has "← Back to my summary" link that returns to the unlocked confirmation page

## Abandoned conversation tracking

`app/api/abandon/route.ts` — if a user interacts but never reaches the summary step, a beacon fires on `beforeunload` / `visibilitychange` (hidden) and emails a partial transcript to events@venuehopper.com. Subject includes message count. Guarded by `abandonSentRef` (fires once) and skips if `emailSent` is true.

## Architecture

### `app/page.tsx`
Client-only chat UI using `useChat` from `@ai-sdk/react`. Manages its own `input` state. Calls `sendMessage({ text })` to send. Watches messages for `type === 'tool-sendSummaryEmail'` and `state === 'output-available'` — when found, saves summary to `sessionStorage('venuehopperSummary')` and redirects to `/confirmation` after a **2-second** delay.

Uses refs (`messagesRef`, `emailSentRef`, `abandonSentRef`) so `beforeunload`/`visibilitychange` handlers always read current values without stale closures.

Send button shows `…` while streaming and surfaces API errors inline.

### `app/api/chat/route.ts`
POST handler. Converts UIMessages with `convertToModelMessages`, streams with `streamText`, returns `toUIMessageStreamResponse()`. Contains `sendSummaryEmail` tool with a zod schema covering 8 required fields.

**Required schema fields:** `availability`, `location`, `budget`, `eventType`, `agenda`, `duration`, `dietaryRestrictions`, `guestCount`

The `execute` closure captures the raw `messages` array and renders them as a readable **Client / VenueHopper** transcript in the summary email.

### `app/confirmation/page.tsx`
Two states:
- **Locked**: blurred summary card + contact form side by side. Contact form has an optional Google sign-in button (GIS script loaded client-side) that pre-fills name + email.
- **Unlocked**: full summary card with Edit button + "See venue options →" button

Unlock state saved to `sessionStorage('venuehopperUnlocked')` and restored on mount.

`startEdit()` pre-populates `clientName` from `contact.name` and `clientContact` from `contact.email + phone` if those fields are empty in the summary.

Edit mode: flips each field to an `<input>` (textarea for agenda). Save hits `/api/update-inquiry`. Cancel reverts. "✓ Saved" flashes for 4 seconds after successful save.

**Summary fields displayed (in order):** Event Type, Date(s), Location, Budget, Guest Count, Duration, Agenda, Dietary Restrictions, Name, Contact

### `app/api/contact/route.ts`
`POST { name, email, phone, summary }` — sends two emails in parallel via `Promise.all`:
1. Internal notification to events@venuehopper.com with contact info + event summary
2. Confirmation email to the user's email with their event summary and a "we'll be in touch within 24 hours" message

### `app/api/update-inquiry/route.ts`
`POST { summary, contact }` — sends updated summary email to events@venuehopper.com, subject "Updated Inquiry — {name}".

### `app/api/abandon/route.ts`
`POST { messages }` — called via `navigator.sendBeacon` when user leaves before completing. Emails a readable partial transcript to events@venuehopper.com. Skips if no user messages.

### `app/api/match/route.ts`
`POST { summary }` — queries Supabase via PostgREST (no SDK, raw fetch with anon key) and returns up to 5 ranked venue packages.

**Parsing:** `guestCount` (max of all numbers), `budget` (upper bound in cents, handles `$5k`, `$2,000–$5,000`), `duration` (`half day` → 4h, takes minimum of a range), `location` (aliases: `LES`, `fidi`, `downtown`, etc. → DB neighborhood names).

**Scoring:** Hard-filters packages where `capacity_max < guestCount`. Soft-scores: neighborhood match (+30), budget fit (+20/+10 bonus if ≥40% of budget), duration fit (+10), has photo (+2). Over-budget packages are penalized proportionally.

**PostgREST select:** Fetches packages with nested `venues`, `package_spaces → spaces → space_photos`, and `venue_photos` in a single request. All tables have public SELECT RLS policies so the anon key is sufficient.

### `app/options/page.tsx`
Client component (`'use client'`). On mount reads `sessionStorage('venuehopperSummary')`, POSTs to `/api/match`, and renders venue cards. Shows skeleton cards while loading. Falls back to the original "Give us 24 hours" holding page if no summary in sessionStorage or no matches returned.

Each **MatchCard** shows: cover photo (space photo preferred over venue photo), venue name, neighborhood pill, address, package name, formatted price (handles Starting at / Minimum Spend / Cash Bar types), capacity, duration, specialties chips, and an "Inquire about this venue →" mailto CTA pre-filled with venue + package name.

### `app/layout.tsx`
Loads Inter (body) and Playfair Display (headings, italic). Includes `<Analytics />` from `@vercel/analytics/next`.

## Emails

All emails use the VenueHopper logo from `https://intake-rapid.vercel.app/logo.svg` (white SVG on colored headers). Logo file is at `public/logo.svg`.

| Email | Trigger | To | Subject |
|-------|---------|-----|---------|
| New Event Inquiry | `sendSummaryEmail` tool | events@venuehopper.com | `New Event Inquiry — {eventType}` |
| New Contact Submission | Contact form submit | events@venuehopper.com | `Contact Info — {name}` |
| User Confirmation | Contact form submit | user's email | `Your VenueHopper inquiry is confirmed` |
| Updated Inquiry | Edit + save | events@venuehopper.com | `Updated Inquiry — {name}` |
| Abandoned Conversation | `beforeunload` / tab hidden | events@venuehopper.com | `Abandoned Conversation — N message(s) sent` |

## Design system

- Background: `#F0EDF6` (light lavender)
- Accent / brand: `#C94BBE` (magenta) — hover darkens to `#a83a9e`
- Headings: Playfair Display italic via CSS var `--font-playfair`
- Body: Inter via CSS var `--font-inter`
- Cards: white, `rounded-2xl`, `shadow-md`, no hard border
- Inputs: `background: #F0EDF6`, no border, `box-shadow: 0 0 0 2px #C94BBE` on focus
- User chat bubbles: `#C94BBE` background, white text
- AI avatar (V): `#C94BBE` circle

## AI SDK v6 notes

This project uses AI SDK **v6** which has breaking changes from v3/v4:
- `tool()` uses `inputSchema` not `parameters`
- Server response: `result.toUIMessageStreamResponse()` (not `toDataStreamResponse`)
- Client messages arrive as UIMessages; use `await convertToModelMessages(messages)` server-side
- `useChat` returns `sendMessage`, `messages`, `status` — no `input`/`handleInputChange`/`handleSubmit`
- Tool execute signature: `execute: async (input: MyType) => result`; must explicitly type-param `tool<INPUT, OUTPUT>()` to avoid TS errors
- Tool part `type` on the client is `tool-{toolName}` (e.g. `tool-sendSummaryEmail`), NOT `tool-invocation`
- Tool result state is `output-available`, NOT `result`
- UIMessage `content` is typed as `unknown` when passed to the email builder — use `JSON.stringify` rather than trying to destructure it
