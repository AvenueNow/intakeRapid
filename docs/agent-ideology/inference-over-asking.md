# Inference Over Asking

**Status:** Core behavioral principle

## What we're trying

The agent should prefer to infer schema fields from package reactions over asking
about them directly. Asking too many questions feels like a form; inferring from
reactions feels like a conversation.

The skeleton fields are opportunities for inference — not a checklist to work
through verbally.

## The hierarchy of how the agent fills fields

1. **User stated it explicitly** (`source: 'stated'`, confidence: 0.9–1.0)
   The user said "we need a private room" or "our budget is $10k." Take it at
   face value.

2. **Strongly inferred from stated context** (`source: 'inferred'`, confidence: 0.7–0.85)
   User says "it's a corporate dinner for board members." The agent infers:
   formality → 4–5, spaceType → seated-dinner, floorPlan → private-room.
   No need to ask.

3. **Inferred from package reaction** (`source: 'probe'`, confidence: 0.5–0.75)
   User reacts negatively to a rooftop package in October. Agent infers:
   indoorOutdoor → indoor, confidence: 0.7. Did not ask.

4. **Still unknown — send a probe**
   If a field has been unknown through multiple turns and no package has tested it,
   the agent selects a package specifically to probe it. Still not asking directly.

5. **Ask directly as last resort**
   If the field is critical (budget ceiling, guest count), blocking package
   selection, and no probe has worked: ask once, clearly, directly.

## What "ask at most one direct question per turn" means

Even when the agent does ask, it asks one thing. Not a list. Not a paragraph of
clarifying questions. One question per turn. The next package handles the rest.

This feels like a conversation. A knowledgeable friend helping you plan an event
asks one thing at a time between showing you options — not a five-item form.

## Inference the agent should always make silently

These should never be asked; they should always be inferred from event type:

| Stated event type | Agent infers |
|-------------------|-------------|
| Corporate dinner | seated, private room, formal 3–4, no DJ |
| Networking event | standing/cocktail, semi-private ok, modern vibe |
| Birthday party | flexible, buyout preferred, fun vibe, DJ often |
| Product launch | AV needs high, branded vibe, standing ok |
| Wedding shower | private room, feminine/soft vibe, lighter bar |

These inferences start at confidence: 0.6 and get updated by package reactions.

## What we accepted

- Some inferences will be wrong. That's fine — a wrong inference that gets
  corrected by a package reaction is more efficient than a correct answer to a
  direct question, because it gives the agent a concrete data point and a story.

- Users who have something specific in mind will volunteer it. The agent doesn't
  need to ask "what vibe are you looking for?" because a user with a strong vibe
  preference will say "I want something dark and moody" in their first message.
  The agent's job is to listen for it, not to prompt it.
