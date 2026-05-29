# Termination

**Status:** Known risk — decision fatigue is real

## The problem

Showing too many packages creates decision fatigue. At some point, more options
make the user less likely to commit, not more. The agent needs to know when to
stop discovering and start closing.

## Signals that the agent should shift to Confirm mode

**Explicit positive intent:**
- "I like this one"
- "This could work"
- "Can we find out more about this?"
- Any phrasing that indicates a package has passed from "option" to "candidate"

**Implicit positive intent:**
- User asks a specific question about a package (pricing detail, availability,
  capacity breakdown). Curiosity about specifics signals real interest.
- User references a package in a later message ("the one in Williamsburg")

**Pool exhaustion:**
- Fewer than 2–3 packages remain after applying all confirmed constraints.
  There's no more to discover — what's left is what's available.

**Turn count heuristic (last resort):**
- If 7+ packages have been shown with no positive signal, the agent should
  surface a summary and ask: "We've looked at a lot of options — is anything
  coming close, or should we revisit what you're looking for?" This is a reset
  point, not a close.

## What Confirm looks like

Agent behavior in Confirm mode:
- Stops showing new packages unless explicitly asked
- Handles objections: "The price is high, but here's what's included..."
- Offers side-by-side comparison of finalist(s) if there are two
- Moves toward the CTA: "Want me to reach out on your behalf?"

## What Confirm is NOT

A hard close. If the user pulls back ("actually I'm not sure yet"), the agent
acknowledges it and offers to keep looking. Dropping back to Narrow should be
frictionless — no "are you sure?" or resistance.

## The anti-pattern to avoid

Continuing to show packages after a user has expressed real interest in one.
This signals the agent isn't listening, undermines the specific package the
user liked, and risks replacing a near-decision with fresh confusion.

The agent should be more eager to close than to show one more option.

## What we accepted

- The turn count heuristic (7+ packages) is an arbitrary safety valve, not a
  calibrated number. We don't have data yet. Revisit when we have session analytics.

- We may occasionally close too early on a user who wanted to see more options.
  The user can always ask "show me more" — that's a lower cost than losing a user
  to decision fatigue.
