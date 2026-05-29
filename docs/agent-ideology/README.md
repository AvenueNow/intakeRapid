# Agent Ideology

Design decisions and non-code thinking behind the VenueHopper agentic experience.
These are "commit logs" for ideas — each file captures a decision, what we're trying,
and the trade-offs we accepted.

## Index

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

## Philosophy

The core bet: **discovery through reaction beats discovery through questioning.**

A form asks questions. A chat asks questions. This agent shows things and watches
how the user responds. The package is the probe. The reaction is the answer.
Every design decision flows from this.
