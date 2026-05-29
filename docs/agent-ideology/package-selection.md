# Package Selection Strategy

**Status:** Core algorithm — drives what the user sees

## What we're trying

At each turn, the agent picks the single best next package by asking:
**what is the highest-value thing I can show right now?**

"Highest-value" means different things in each mode:
- **Collect:** maximize information gain on uncertain schema fields
- **Narrow:** maximize satisfaction of confirmed constraints
- **Confirm:** show the strongest match for the finalist set

## The scoring function (conceptual)

```
score(package) =
    InformationGain(package, schema.lowConfidenceFields)   // probes unknowns
  + ConstraintFit(package, schema.highConfidenceFields)    // satisfies what we know
  - RepetitionPenalty(package.id, schema.packagesShown)    // never repeat
  - DealBreakerViolation(package, schema.dealbreakers)     // hard filter
  - OverBudgetPenalty(package, schema.budget)              // soft penalty, not hard cut
```

**InformationGain** is high when the package tests a field we're uncertain about.
A package with a rooftop space probes `indoorOutdoor`. A package with a DJ included
probes `music`. A high-end package probes `budget.flexibility`.

**OverBudgetPenalty** is a soft penalty, not a hard cut. A package 10% over budget
that is otherwise the perfect fit should still be shown with appropriate framing:
"This one is slightly over your ceiling — worth knowing if it's the right vibe."

## The agent narrates the selection

Every package shown should include a brief explanation of why the agent chose it.
This keeps the interaction transparent and teaches the user that the agent is
actually listening:

> "Given you said no outdoor spaces, I went with this one in the LES — I also
> wanted to see how you feel about a semi-private setup vs. a full buyout."

Narration serves double duty: it explains the choice AND names what the agent is
probing for, which often prompts the user to answer the probe directly.

## What we explicitly ruled out

- **Showing a ranked list and asking the user to pick:** Loses the structured
  signal we need, triggers choice paralysis, and gives the agent no way to learn
  from the rejection of items 2-5.

- **Picking randomly from high-scoring packages:** Determinism matters — the same
  schema state should produce the same next package. Randomness makes the agent
  feel scatterbrained.

- **Always picking the highest-scoring package on pure constraint fit:** In Collect
  mode, the "best fit" package may not probe anything new. Information gain must
  be weighted at least as heavily as fit until the schema is mostly filled.

## One package per turn

The API returns exactly one package. The `/api/match` endpoint accepts the current
schema + array of already-shown package IDs and returns the single best next pick.

This is a deliberate constraint. "Here are 5 options" is a product list.
"Here is my next suggestion, and here's why" is a conversation.
