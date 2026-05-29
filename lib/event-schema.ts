// ── Confidence-weighted field ─────────────────────────────────────────────────
// Every schema field the agent "believes" carries a confidence score (0–1)
// and a source tag so we know how firm the belief is and where it came from.

export type ConfidenceSource = 'stated' | 'inferred' | 'probe';

export interface Confidence<T> {
  value:      T | null;
  confidence: number;          // 0–1; 0 = unknown, 1 = certain
  source:     ConfidenceSource;
}

function unknown<T>(): Confidence<T> {
  return { value: null, confidence: 0, source: 'inferred' };
}

// ── EventSchema ───────────────────────────────────────────────────────────────
// The persistent cognitive state of the options session.
// The agent updates this after processing each user message.
// Stored in sessionStorage('venuehopperSchema') on the client.
// Passed to /api/match on every request — the API never owns state.

export interface EventSchema {
  // ── Logistics ────────────────────────────────────────────────────────────
  date:         Confidence<string>;   // "Oct 15" | "Nov 2026" | date range
  guestCount:   Confidence<number>;   // upper bound when a range is given
  duration:     Confidence<number>;   // hours; 4 = half day, 8 = full day

  // ── Space ─────────────────────────────────────────────────────────────────
  spaceType:    Confidence<SpaceType>;
  indoorOutdoor:Confidence<IndoorOutdoor>;
  floorPlan:    Confidence<FloorPlan>;
  neighborhood: {
    preferred:    string[];           // DB neighborhood names
    dealbreakers: string[];
  };

  // ── Atmosphere ────────────────────────────────────────────────────────────
  vibes: {
    liked:    string[];               // e.g. 'industrial', 'rooftop', 'intimate'
    disliked: string[];
  };
  formality: Confidence<number>;      // 1 (very casual) – 5 (black tie)

  // ── Food & Beverage ───────────────────────────────────────────────────────
  catering:   Confidence<CateringType>;
  bar:        Confidence<BarType>;
  dietary:    { restrictions: string[] };

  // ── Production ────────────────────────────────────────────────────────────
  music:      Confidence<MusicType>;
  av:         { needs: string[] };    // e.g. 'projector', 'screens', 'PA'
  lighting:   { needs: string[] };    // e.g. 'custom', 'standard', 'blackout'

  // ── Budget ────────────────────────────────────────────────────────────────
  budget: {
    ceiling:     number | null;       // in cents; null = unknown
    perHead:     number | null;       // derived: ceiling / guestCount
    flexibility: BudgetFlexibility;
  };
  priorities: string[];               // ranked: ['price', 'location', 'vibe', ...]

  // ── Session meta ──────────────────────────────────────────────────────────
  agentMode:     AgentMode;
  packagesShown: string[];            // packageIds already shown — never repeat
  dealbreakers:  string[];            // absolute nos in natural language

  // ── Extensible ────────────────────────────────────────────────────────────
  // The agent may add fields the skeleton doesn't anticipate.
  // e.g. danceFloorCapacity, presentationAV, kosherCatering
  [key: string]: unknown;
}

// ── Enum-like string literals ─────────────────────────────────────────────────

export type SpaceType =
  | 'seated-dinner'
  | 'cocktail-reception'
  | 'hybrid'
  | 'ceremony'
  | 'conference';

export type IndoorOutdoor = 'indoor' | 'outdoor' | 'either';

export type FloorPlan = 'private-room' | 'buyout' | 'semi-private';

export type CateringType = 'venue' | 'outside' | 'none';

export type BarType = 'open' | 'cash' | 'beer-wine' | 'none';

export type MusicType = 'DJ' | 'live-band' | 'playlist' | 'none';

export type BudgetFlexibility = 'firm' | 'soft' | 'unknown';

export type AgentMode = 'collect' | 'narrow' | 'confirm';

// ── Factory ───────────────────────────────────────────────────────────────────

export function createEmptySchema(): EventSchema {
  return {
    date:          unknown<string>(),
    guestCount:    unknown<number>(),
    duration:      unknown<number>(),

    spaceType:     unknown<SpaceType>(),
    indoorOutdoor: unknown<IndoorOutdoor>(),
    floorPlan:     unknown<FloorPlan>(),
    neighborhood:  { preferred: [], dealbreakers: [] },

    vibes:         { liked: [], disliked: [] },
    formality:     unknown<number>(),

    catering:      unknown<CateringType>(),
    bar:           unknown<BarType>(),
    dietary:       { restrictions: [] },

    music:         unknown<MusicType>(),
    av:            { needs: [] },
    lighting:      { needs: [] },

    budget: {
      ceiling:     null,
      perHead:     null,
      flexibility: 'unknown',
    },
    priorities: [],

    agentMode:     'collect',
    packagesShown: [],
    dealbreakers:  [],
  };
}

// ── MatchedPackage ─────────────────────────────────────────────────────────────
// Shape returned by /api/match — shared here so route.ts and agent tools
// can import a single source of truth.

export interface MatchedPackage {
  packageId:     string;
  packageName:   string;
  packageType:   string;
  privacyLevel:  string;
  durationHours: number;
  price:         number | null;
  originalPrice: number | null;
  specialties:   string[] | null;
  venueId:       string;
  venueName:     string;
  neighborhood:  string;
  address:       string;
  venueType:     string;
  capacityMin:   number | null;
  capacityMax:   number | null;
  coverPhoto:    string | null;
}
