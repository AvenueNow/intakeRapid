# Agent Ideology Eval Log

This file records every run of `npm run eval:agent` with scores and notable findings.
Update this file after every eval run — even partial or failed ones.

**How to run:** `npm run eval:agent` from `intake-form/`
**Report output:** `test-results/agent-eval.md` (overwritten each run)
**Script:** `scripts/eval-agent.ts`

---

## Instructions for future Claude Code sessions

> **READ THIS BEFORE CHANGING THE SYSTEM PROMPT.**
>
> 1. Run `npm run eval:agent` before making any prompt changes to get a baseline.
> 2. Make your changes to `lib/options-system-prompt.ts`.
> 3. Re-run `npm run eval:agent`. Score must stay at or above the previous run.
> 4. Add an entry to this file with the date, scores, and what changed.
> 5. Add an entry to `docs/agent-ideology/prompt-changelog.md`.
>
> The eval uses real Anthropic API calls (Sonnet as agent, Haiku as judge).
> Each full run costs ~$0.10–0.20 in API credits. Don't run it in a loop.
>
> If a scenario is failing consistently, read the judge's specific issue text
> in the console output — it's specific enough to write a targeted fix.
> Avoid broad rewrites; one targeted clause usually fixes a specific failure.

---

## Run history

### 2026-05-29 — Baseline + first iteration

**Context:** First eval run, immediately after extracting the system prompt to
`lib/options-system-prompt.ts`. Two passes over the prompt were done in a single
session based on eval feedback.

**Model:** claude-sonnet-4-6 (agent) · claude-haiku-4-5-20251001 (judge)
**Scenarios:** 4

| Scenario | Run 1 | Run 2 |
|----------|-------|-------|
| Happy hour — vague start | 25% | 75% |
| Corporate dinner — explicit | 75% | 100% |
| Birthday party — unknown budget | 25% | 75% |
| Product launch — no details yet | 50% | 75% |
| **Overall** | **63%** | **81%** |

**Criteria breakdown (Run 2 failures):**

All remaining failures were the same root cause: agent phrasing follow-ups as
two embedded questions in one sentence.
Example: "Does the exclusivity feel closer, or is the Brooklyn location a friction point?"
This reads as two separate questions (X feel closer AND Y a problem?), not one.

**Failures by criteria:**
- `one_question_max` — 3 fails across 3 scenarios (all same pattern)
- `warm_expert_voice` — 1 fail (birthday party turn 3: transactional tone when asking for budget)
- `deliberate_choice` / `narration_specific` — 0 fails in Run 2 (fixed by Run 1 improvements)
- `no_filler_phrases` — 0 fails in Run 2 (forbidden phrases list in prompt working)

**What was fixed between Run 1 and Run 2:**
See `docs/agent-ideology/prompt-changelog.md` entry for 2026-05-29.

**What remains unfixed:**
- One-question rule still occasionally violated with "X feel right, or is Y a problem?" pattern.
  A targeted clause was added at end of Run 2 with examples. Not re-tested (would be Run 3).
- Budget question phrasing (birthday party scenario) still sounds transactional.
  The `warm_expert_voice` criteria caught it but no targeted fix was applied yet.

**Notes:**
- The corporate dinner scenario hit 100% in Run 2 — use it as a reference for
  what good agent behavior looks like in the happy path.
- The mock package pool only has 3 packages (Press Lounge, Gramercy Tavern, Wythe Hotel).
  The agent sometimes refers back to packages already shown. This is a known limitation
  of the eval fixture, not a real-world problem. Consider expanding `MOCK_PACKAGES`
  in `scripts/eval-agent.ts` if scenarios need 4+ unique packages.

---

## Scoring reference

Each turn is judged pass/fail on up to 7 criteria. A turn passes if the judge
returns `"overall": "pass"`. Scenario score = passing turns / total turns × 100.
Overall score = all passing turns / all turns × 100.

| Criteria | What it checks |
|----------|----------------|
| `narration_specific` | Narration references specific package attributes (neighborhood, privacy, price, why chosen now) |
| `deliberate_choice` | Agent explains why THIS package was selected as a probe at THIS moment |
| `probing_unknown` | Agent surfaces a dimension the client hasn't considered yet |
| `one_question_max` | Only one question asked per turn |
| `warm_expert_voice` | Response sounds like a knowledgeable friend, not a form-filler |
| `no_filler_phrases` | No forbidden phrases ("I pulled this", "here are some options", etc.) |
| `infers_silently` | Agent infers from event type rather than asking about inferrable fields |
