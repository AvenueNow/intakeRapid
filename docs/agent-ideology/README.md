# Agent Ideology

Design decisions, test results, and prompt iteration history for the VenueHopper
agentic venue discovery experience.

---

## For Claude Code sessions — read this first

> **Before editing the system prompt or agent behavior:**
>
> 1. Run `npm run eval:agent` from `intake-form/` to get the current score.
> 2. Read `docs/agent-ideology/eval-log.md` to understand recent failures.
> 3. Read `docs/agent-ideology/prompt-changelog.md` to understand prior decisions.
> 4. Make one targeted change to `lib/options-system-prompt.ts`.
> 5. Re-run eval. Score must not drop below previous baseline.
> 6. Log the result in both `eval-log.md` and `prompt-changelog.md`.
>
> **Current baseline:** 81% (2026-05-29, Run 2). Do not merge a prompt change
> that drops below this score.

---

## Index

### Prompt & eval (start here when iterating)

| File | Purpose |
|------|---------|
| [eval-log.md](eval-log.md) | Every eval run: date, scores per scenario, failures, notes |
| [prompt-changelog.md](prompt-changelog.md) | Every meaningful prompt change: what, why, result |

### Ideology reference (read before changing behavior)

| File | Core idea |
|------|-----------|
| [packages-as-probes.md](packages-as-probes.md) | Showing a package is asking a question |
| [event-schema.md](event-schema.md) | The persistent cognitive state of the session |
| [three-modes.md](three-modes.md) | Collect → Narrow → Confirm: the agent's operating modes |
| [package-selection.md](package-selection.md) | How the agent picks what to show next |
| [cold-start.md](cold-start.md) | What to do when we know almost nothing |
| [schema-drift.md](schema-drift.md) | Users change their minds — the schema must too |
| [inference-over-asking.md](inference-over-asking.md) | Prefer to infer from reactions over direct questions |
| [termination.md](termination.md) | Knowing when to stop showing packages and close |

---

## Philosophy

The core bet: **discovery through reaction beats discovery through questioning.**

A form asks questions. A chat asks questions. This agent shows things and watches
how the user responds. The package is the probe. The reaction is the answer.
Every design decision flows from this.
