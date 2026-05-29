# Cold Start

**Status:** Unsolved — most uncertain design decision

## The problem

The first package is shown when the schema is nearly empty. We know almost nothing.
Whatever we show will likely be somewhat wrong. The question is: what is the best
"wrong" package to show first?

## What we're trying

**Default to the statistically most common NYC event profile:**
- Type: cocktail reception
- Guest count: 50–80
- Budget: $5,000–$10,000
- Location: Manhattan (Midtown or Lower Manhattan)
- Vibe: modern, upscale
- Indoor, private or semi-private

This gives us a starting package that is wrong for most users in some way but
catastrophically wrong for almost no one. The reaction to this package is high
information — it tells us which dimensions the user deviates on.

## The agent's framing for the first package

The agent should be upfront that this is a starting point, not a recommendation:

> "I don't know much about your event yet, so let me start with something typical
> and see where you'd take it from here."

or, for a user who has given a few details already:

> "Based on what you've told me so far, here's a first direction — react however
> feels honest."

Low-commitment framing invites honest reactions. High-commitment framing ("I think
this is perfect for you") causes users to soften their negative reactions, which
pollutes the signal.

## What makes this hard

The cold start problem is really a *trust* problem. The user doesn't know yet
whether the agent is good at this. A strongly wrong first package without good
framing destroys confidence before the agent has had a chance to demonstrate it
learns.

The solution is framing, not perfect first picks. The agent earns trust by showing
that it updates — not by being right the first time.

## Alternative considered: ask 2-3 questions first

Collect the absolute minimum (event type + rough guest count) before showing
anything. This narrows the cold start space significantly and makes the first
package less likely to be way off.

**Trade-off accepted:** This adds friction before the user has seen anything
worth engaging with. Prioritizing the first package being a reaction-generator
(not a perfect fit) means we can tolerate more cold start wrongness.

**Open:** We may want to revisit this if analytics show high drop-off before the
second package.
