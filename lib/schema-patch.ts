// Canonical SchemaPatch type, applyPatch function, and the Zod inputSchema
// for the updateSchema tool. Imported by both /api/chat and /api/options-chat.

import { z } from 'zod';
import { type EventSchema } from './event-schema';

// ── Patch shape ───────────────────────────────────────────────────────────────
// Arrays use append semantics (agent adds, never removes).
// Confidence fields replace. Nested objects are merged shallowly.

export type SchemaPatch = {
  date?:         { value: string; confidence: number; source: 'stated' | 'inferred' | 'probe' };
  guestCount?:   { value: number; confidence: number; source: 'stated' | 'inferred' | 'probe' };
  duration?:     { value: number; confidence: number; source: 'stated' | 'inferred' | 'probe' };
  spaceType?:    { value: string; confidence: number; source: 'stated' | 'inferred' | 'probe' };
  indoorOutdoor?:{ value: string; confidence: number; source: 'stated' | 'inferred' | 'probe' };
  floorPlan?:    { value: string; confidence: number; source: 'stated' | 'inferred' | 'probe' };
  neighborhoodAdd?:         string;
  neighborhoodDealbreaker?: string;
  vibesLiked?:    string[];
  vibesDisliked?: string[];
  formality?:     { value: number; confidence: number; source: 'stated' | 'inferred' | 'probe' };
  catering?:      { value: string; confidence: number; source: 'stated' | 'inferred' | 'probe' };
  bar?:           { value: string; confidence: number; source: 'stated' | 'inferred' | 'probe' };
  dietaryAdd?:    string[];
  music?:         { value: string; confidence: number; source: 'stated' | 'inferred' | 'probe' };
  budgetCeiling?:      number;
  budgetPerHead?:      number;
  budgetFlexibility?:  'firm' | 'soft' | 'unknown';
  agentMode?:          'collect' | 'narrow' | 'confirm';
  dealbreakerAdd?:     string;
};

export function applyPatch(schema: EventSchema, patch: SchemaPatch): EventSchema {
  const s = { ...schema };
  if (patch.date)          s.date          = patch.date          as EventSchema['date'];
  if (patch.guestCount)    s.guestCount    = patch.guestCount    as EventSchema['guestCount'];
  if (patch.duration)      s.duration      = patch.duration      as EventSchema['duration'];
  if (patch.spaceType)     s.spaceType     = patch.spaceType     as EventSchema['spaceType'];
  if (patch.indoorOutdoor) s.indoorOutdoor = patch.indoorOutdoor as EventSchema['indoorOutdoor'];
  if (patch.floorPlan)     s.floorPlan     = patch.floorPlan     as EventSchema['floorPlan'];
  if (patch.formality)     s.formality     = patch.formality     as EventSchema['formality'];
  if (patch.catering)      s.catering      = patch.catering      as EventSchema['catering'];
  if (patch.bar)           s.bar           = patch.bar           as EventSchema['bar'];
  if (patch.music)         s.music         = patch.music         as EventSchema['music'];

  s.neighborhood = { ...s.neighborhood };
  if (patch.neighborhoodAdd && !s.neighborhood.preferred.includes(patch.neighborhoodAdd))
    s.neighborhood.preferred = [...s.neighborhood.preferred, patch.neighborhoodAdd];
  if (patch.neighborhoodDealbreaker && !s.neighborhood.dealbreakers.includes(patch.neighborhoodDealbreaker))
    s.neighborhood.dealbreakers = [...s.neighborhood.dealbreakers, patch.neighborhoodDealbreaker];

  s.vibes = { ...s.vibes };
  if (patch.vibesLiked)    s.vibes.liked    = [...new Set([...s.vibes.liked,    ...patch.vibesLiked])];
  if (patch.vibesDisliked) s.vibes.disliked = [...new Set([...s.vibes.disliked, ...patch.vibesDisliked])];

  s.dietary = { ...s.dietary };
  if (patch.dietaryAdd) s.dietary.restrictions = [...new Set([...s.dietary.restrictions, ...patch.dietaryAdd])];

  s.budget = { ...s.budget };
  if (patch.budgetCeiling     !== undefined) s.budget.ceiling     = patch.budgetCeiling;
  if (patch.budgetPerHead     !== undefined) s.budget.perHead     = patch.budgetPerHead;
  if (patch.budgetFlexibility !== undefined) s.budget.flexibility = patch.budgetFlexibility;

  if (patch.agentMode)     s.agentMode = patch.agentMode;
  if (patch.dealbreakerAdd && !s.dealbreakers.includes(patch.dealbreakerAdd))
    s.dealbreakers = [...s.dealbreakers, patch.dealbreakerAdd];

  return s;
}

// ── Zod input schema for the updateSchema tool ────────────────────────────────
// Shared between /api/chat and /api/options-chat.

const confidenceField = <T extends z.ZodTypeAny>(valueSchema: T) =>
  z.object({ value: valueSchema, confidence: z.number(), source: z.enum(['stated', 'inferred', 'probe']) }).optional();

export const updateSchemaInputSchema = z.object({
  date:          confidenceField(z.string()),
  guestCount:    confidenceField(z.number()),
  duration:      confidenceField(z.number()),
  spaceType:     confidenceField(z.enum(['seated-dinner', 'cocktail-reception', 'hybrid', 'ceremony', 'conference'])),
  indoorOutdoor: confidenceField(z.enum(['indoor', 'outdoor', 'either'])),
  floorPlan:     confidenceField(z.enum(['private-room', 'buyout', 'semi-private'])),
  neighborhoodAdd:         z.string().optional().describe('Single neighborhood name to add to preferred list'),
  neighborhoodDealbreaker: z.string().optional().describe('Single neighborhood to mark as dealbreaker'),
  vibesLiked:    z.array(z.string()).optional().describe('Vibe words to append to liked list, e.g. ["intimate","moody"]'),
  vibesDisliked: z.array(z.string()).optional().describe('Vibe words to append to disliked list'),
  formality:     confidenceField(z.number().min(1).max(5)),
  catering:      confidenceField(z.enum(['venue', 'outside', 'none'])),
  bar:           confidenceField(z.enum(['open', 'cash', 'beer-wine', 'none'])),
  dietaryAdd:    z.array(z.string()).optional().describe('Dietary restrictions to append'),
  music:         confidenceField(z.enum(['DJ', 'live-band', 'playlist', 'none'])),
  budgetCeiling:      z.number().optional().describe('Budget ceiling in cents, e.g. $8000 = 800000'),
  budgetPerHead:      z.number().optional().describe('Per-head budget in cents'),
  budgetFlexibility:  z.enum(['firm', 'soft', 'unknown']).optional(),
  agentMode:          z.enum(['collect', 'narrow', 'confirm']).optional().describe('Transition mode when appropriate'),
  dealbreakerAdd:     z.string().optional().describe('Absolute dealbreaker in natural language'),
});
