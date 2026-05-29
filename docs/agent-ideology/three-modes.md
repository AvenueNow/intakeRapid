# Three Agent Modes

**Status:** Core behavioral model

## What we're trying

The agent is always in one of three modes. Mode governs what the agent prioritizes
in its next turn: what package it selects, what questions it asks, and how it frames
its response.

Transitions are fluid and driven by schema state, not a timer or step counter.

---

## Collect

**Trigger:** Schema has significant unknowns — confidence on key fields is < 0.5

**Agent behavior:**
- Selects packages that will probe the most uncertain fields
- Frames each package as "I wanted to see your reaction to X" — transparent about
  the discovery purpose
- Asks at most one direct question per turn, and only when a package reaction won't
  answer it efficiently
- Keeps the conversation moving; never interrogates

**Signs we should stay in Collect:** User reactions are generating new schema fields
or significantly changing confidence scores.

---

## Narrow

**Trigger:** Core fields (budget, spaceType, indoorOutdoor, vibe) are filled with
confidence > 0.7. Still multiple viable packages in inventory.

**Agent behavior:**
- Selects packages that satisfy all confirmed constraints simultaneously
- Explains *why* it picked this one: "Given you want indoor Brooklyn and under $8k,
  this is the closest match I have."
- Starts resolving lower-priority fields (music, AV, catering) through packages
  rather than questions
- Surfaces a schema summary after 2-3 Narrow packages: "Here's what I'm optimizing
  for — does this look right?" Gives user a correction point.

**Signs we should transition to Confirm:** User expresses clear positive intent on
a package, or the pool of valid packages drops below 2-3.

---

## Confirm

**Trigger:** User has expressed positive intent on one or two packages, or schema
constraints have narrowed the pool to ≤ 2 viable options.

**Agent behavior:**
- Handles objections and trade-off questions
- Offers to compare the finalist(s) side by side
- Moves toward the inquiry CTA — "Want me to reach out about this one?"
- Does NOT show new packages unless the user explicitly asks

**What Confirm is not:** A hard close. If the user pulls back, the agent should
recognize the signal and drop back to Narrow without making it awkward.

---

## Mode is not shown to the user

The mode label is an internal concept. The user should experience a conversation
that feels natural, not a state machine. The mode governs agent behavior; it does
not produce any visible UI state.
