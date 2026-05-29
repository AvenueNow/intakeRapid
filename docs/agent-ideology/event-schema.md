# Event Schema

**Status:** Core data structure — needs to be defined before any other changes

## What we're trying

A typed, confidence-weighted object that represents everything the agent currently
believes about the user's event. It is the persistent cognitive state of the session.

Every field carries a confidence score (0–1) and a source tag so the agent knows
how firm its beliefs are and where they came from.

## Schema skeleton

```ts
type Confidence = { value: unknown; confidence: number; source: 'stated' | 'inferred' | 'probe' }

interface EventSchema {
  // Logistics
  date:         Confidence   // "Oct 15" | range | null
  guestCount:   Confidence   // number | range
  duration:     Confidence   // hours | "half day" | "full day"

  // Space
  spaceType:    Confidence   // 'seated-dinner' | 'cocktail-reception' | 'hybrid' | 'ceremony'
  indoorOutdoor:Confidence   // 'indoor' | 'outdoor' | 'either'
  neighborhood: { preferred: string[]; dealbreakers: string[] }
  floorPlan:    Confidence   // 'private-room' | 'buyout' | 'semi-private'

  // Atmosphere
  vibes:        { liked: string[]; disliked: string[] }
  formality:    Confidence   // 1 (casual) – 5 (black tie)

  // Food & Beverage
  catering:     Confidence   // 'venue' | 'outside' | 'none'
  bar:          Confidence   // 'open' | 'cash' | 'beer-wine' | 'none'
  dietary:      { restrictions: string[] }

  // Production
  music:        Confidence   // 'DJ' | 'live-band' | 'playlist' | 'none'
  av:           { needs: string[] }
  lighting:     { needs: string[] }

  // Budget
  budget: {
    ceiling:     number      // in cents
    perHead:     number | null
    flexibility: 'firm' | 'soft' | 'unknown'
  }
  priorities:   string[]     // ranked: ['price', 'location', 'vibe', ...]

  // Session meta
  packagesShown: string[]    // IDs already seen — never repeat
  dealbreakers:  string[]    // absolute nos, natural language
  agentMode:    'collect' | 'narrow' | 'confirm'

  // Extensible: agent may add fields not in the skeleton
  // e.g. danceFlorCapacity, presentationAV, kosherCatering
  [key: string]: unknown
}
```

## Two layers

**The skeleton** — fields the agent always looks for. Applies to most events.

**The extensible layer** — fields the agent injects when the event type warrants them.
A bat mitzvah needs dance floor capacity. A product launch needs a presentation AV
spec. The agent adds these when it decides they matter.

## What confidence scores enable

- Fields with low confidence are candidates for probing via package selection.
- High-confidence fields drive hard filtering (don't show packages that violate them).
- Low-confidence fields drive soft filtering + probe selection.
- When new signals contradict a high-confidence field, the agent should lower its
  confidence and flag the contradiction rather than silently overwriting.

## Persistence

Stored in `sessionStorage('venuehopperSchema')` on the client. Passed to
`/api/match` on every request. The API never owns state — the client is the source
of truth for the schema.

## What we accepted

- The schema can be partially filled and still useful. Most sessions will end
  without every field populated. That's fine — we only need enough to make good
  package selections.

- The schema is not shown to the user directly. It's the agent's internal model.
  The user sees packages and conversation, not a form being filled out.
