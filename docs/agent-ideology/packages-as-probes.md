# Packages as Probes

**Status:** Core principle — drives all other decisions

## What we're trying

Treat each package shown not as a candidate answer, but as a question.

Showing a rooftop terrace in Meatpacking elicits information the agent could never
extract by asking "what vibe do you want?" The user's reaction — enthusiastic,
reluctant, indifferent — is richer data than any answer to a direct question.

A user who has never planned an event doesn't know they hate industrial lofts until
they see one. The package makes the abstract concrete, and concrete things get
honest reactions.

## What we accepted

- We have to show packages before the schema is fully filled. This is intentional.
  The first package is shown with almost no data — and that's fine, because its
  purpose is to generate data, not to be correct.

- Some packages shown will be wrong matches. That's not a failure — a negative
  reaction on a clearly wrong package is one of the most efficient schema updates
  possible. ("I hated that" is faster than 3 follow-up questions.)

- The user experience feels more like browsing with a knowledgeable friend than
  filling out a form. This is the intended feeling.

## What we did NOT try

- Showing a list of options and letting the user pick: loses the guided discovery
  dynamic, triggers choice paralysis, and gives the agent no structured signal.

- Asking all questions upfront then showing packages: front-loads friction before
  the user has seen anything worth committing to.

## Open questions

- How many "wrong" packages can we show before users lose confidence in the agent?
  Hypothesis: 1-2 clearly wrong packages is fine if the agent narrates why it chose
  them ("I wanted to test your reaction to outdoor spaces"). More than that without
  visible learning degrades trust.
