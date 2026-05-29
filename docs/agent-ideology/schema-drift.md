# Schema Drift

**Status:** Known hard problem — no perfect solution

## The problem

Users change their minds. A field set with high confidence early can become wrong
later. If the agent treats every stated preference as permanent, it will keep
showing the user things they've already implicitly moved away from.

Common patterns:
- Budget ceiling rises after seeing what the money actually buys
- Neighborhood preference softens when a great package appears elsewhere
- "I want it to feel casual" becomes "actually, more polished" after seeing options

## What we're trying

**Confidence decay on contradiction.** When a new signal contradicts an existing
high-confidence field, the agent does not silently overwrite. Instead:
1. Lower the confidence score of the contradicted field
2. Note the contradiction in the session log
3. Ask a clarifying question or show a package that forces a choice between
   the old value and the new signal

This surfaces the drift explicitly rather than letting the agent drift silently
in whatever direction the last message pointed.

**Example:**
> Schema: `neighborhood.preferred = ['Williamsburg'], confidence: 0.85, source: 'stated'`
> New signal: user reacts positively to a package in the LES
> Agent behavior: lower confidence to 0.5, surface it —
> "You seemed to like that LES space — I thought you wanted Williamsburg. Are you
> open to other neighborhoods if the right space comes up?"

## What the agent should not do

- Silently overwrite the old value with the new one. The user may not have meant
  to override — they may just be reacting positively to one package without
  changing their general preference.

- Ignore the contradiction and keep showing Williamsburg packages. The schema
  would become stale and the agent would stop learning.

## Re-opening settled questions

After 4–5 packages in Narrow mode, the agent should briefly surface its current
model of the event and invite correction:

> "Here's what I'm looking for on your behalf: indoor, Brooklyn, $8k ceiling,
> cocktail reception for ~70 guests, modern vibe. Does that sound right, or has
> anything shifted?"

This is a safety valve for accumulated drift. It gives the user a chance to correct
the model before the agent commits to it in the final inquiry.

## What we accepted

- Some drift will go undetected. We can't catch every subtle preference shift.
  The model will sometimes be slightly wrong in ways that don't surface until the
  final package comparison. That's acceptable.

- Surfacing contradictions too aggressively feels interrogative. The agent should
  catch significant drift (a whole neighborhood changing, an indoor/outdoor flip)
  but not minor ones (a slight tone difference in how the user described the vibe).

## Open questions

- What confidence delta constitutes a "significant" contradiction worth surfacing?
  Gut: if the new signal would move confidence by more than 0.3 on a field that
  was above 0.7, surface it.
