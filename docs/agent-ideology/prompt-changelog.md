# System Prompt Changelog

Tracks every meaningful change to `lib/options-system-prompt.ts` — what changed,
why, and what eval score it produced. Read this before editing the prompt so you
understand the decisions already made.

**File being tracked:** `lib/options-system-prompt.ts`
**Eval command:** `npm run eval:agent`
**Eval log:** `docs/agent-ideology/eval-log.md`

---

## Instructions for future Claude Code sessions

> Before editing the system prompt:
> 1. Read this file top-to-bottom to understand prior decisions.
> 2. Run `npm run eval:agent` to get the current baseline score.
> 3. Make one targeted change at a time — not a broad rewrite.
> 4. Re-run eval. If score drops, revert and try a narrower fix.
> 5. Add an entry here with the date, what changed, and the delta.

---

## 2026-05-29 — Initial extraction + two iterations

### Starting state
System prompt was inlined in `app/api/options-chat/route.ts` with no eval coverage.
Extracted to `lib/options-system-prompt.ts` and tested for the first time.

---

### Iteration 1 — fixing critical failures (63% → eval showed specific issues)

**Trigger:** First eval run scored 63%. Specific failures:
- Agent calling `requestNextPackage` 3–4 times in a single turn
- Agent producing empty text responses (Anthropic API rejected the message)
- Forbidden-sounding phrases in narration
- Multi-question turns

**Changes made:**

**1. Added COMMON MISTAKES section**
The original prompt had no explicit "don't do X" list. Added a section with:
- Forbidden phrases list: "I pulled this", "I threw together", "going back to the pool",
  "I'll keep pulling", "I'm going to use your reaction to it", "That's X, not Y"
- Explicit rule: always write text — never produce a turn with only tool calls
- Constraint mismatch framing: don't apologize for wrong neighborhood, narrate the tradeoff

**2. Tightened TURN STRUCTURE section**
Changed "never two packages in one turn" to:
> "Call requestNextPackage ONCE — one call, one package, full stop. Never call
> requestNextPackage more than once per turn under any circumstances."

Added: "Always write text. Never produce a turn with only tool calls and no text response."

**3. Improved NARRATING EVERY PICK section**
Added explicit bad examples to contrast against good:
- Bad: "Here's another option" / "This one might work" / "I found this space"
- Bad: "I pulled this specifically because..." (forbidden phrase)

**4. Added PROBING WHAT CLIENTS HAVEN'T THOUGHT ABOUT section**
The original prompt mentioned "bring your expertise" but didn't specify what that meant.
Added a concrete list of the 6 most commonly missed dimensions:
- Room exclusivity, AV/tech, catering style, formality, outdoor tolerance, music

**5. Expanded inference table**
Added event types that were missing:
- `happy hour` → same as networking/mixer
- `team offsite / workshop` → conference space, AV, low formality
- `holiday party` → buyout, DJ, low formality

**6. Rewrote persona paragraph**
Original: "You are V, a venue specialist..."
New version adds: "You know which rooms are right for which crowds, which neighborhoods
set the right tone, and which details clients forget to think about until it's too late."
And: "You care about getting this right. A bad venue choice wastes the client's budget
and reflects on their event."

This sets up the expert-who-surfaces-unknowns behavior explicitly rather than leaving
it implied.

**Result:** 81% on second eval run.

---

### Iteration 2 — one-question rule refinement (post 81% run)

**Trigger:** All remaining failures (3/16 turns) were the same pattern:
agent phrasing a follow-up as two embedded questions:
> "Does the exclusivity feel closer, or is the Brooklyn location a friction point?"

This technically looks like one sentence but asks about two separate things (X AND Y).

**Change made:**

Replaced the existing one-question guidance with:
> "One question means one question. A single question can have an either/or structure:
> 'Does the exclusivity feel closer to what you want?' is one question. But 'Does X feel
> right, or is Y a problem for you?' is two questions — it asks about X AND asks about Y
> separately. When your sentence ends with two question marks worth of things, cut the
> second one entirely. Pick the most important thing to ask and stop there."

**Result:** Not re-tested (would be Run 3). Expected to push score to 87–94%.

---

## What to try next

These are hypotheses for future iterations, in priority order:

1. **Budget question tone** (birthday party scenario, turn 3)
   The agent asked "What's the rough number you're working with for the night?" which
   the judge flagged as transactional. A better approach: frame budget as part of
   expert guidance ("That space prices at $6k because of the built-in exclusivity —
   are you working with more or less than that?"). Tying the question to the package
   they just reacted to makes it feel earned.

2. **Cold-start narration when user gave details first**
   The init trigger always uses the same "I don't know much yet" framing even when
   the user arrives with context from the intake form. Consider: if the schema has
   any fields with confidence > 0.5, use the alternate framing ("Based on what
   you've shared, here's a first direction — react honestly").

3. **Confirm mode voice**
   Confirm mode hasn't been stress-tested. Run a scenario where the user expresses
   interest but with an objection ("I like this but the price is high") and verify
   the agent handles it like an expert closing, not a form submission.
