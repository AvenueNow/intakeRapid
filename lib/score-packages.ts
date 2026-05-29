// Core package-fetch + scoring logic used by both /api/match and the
// requestNextPackage chat tool. Extracted here to avoid HTTP roundtrips.

import { type EventSchema, type MatchedPackage } from './event-schema';

const SUPABASE_URL      = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

// ── DB row types ──────────────────────────────────────────────────────────────

export interface Photo      { image_url: string; is_cover: boolean; }
export interface Space      { capacity_min: number | null; capacity_max: number | null; space_photos: Photo[]; }
export interface Venue      { id: string; name: string; neighborhood: string; address: string; venue_type: string; venue_photos: Photo[]; }
export interface PackageRow {
  id: string; name: string; package_type: string; privacy_level: string;
  duration_hours: number; discount_price: number | null; original_price: number | null;
  specialties: string[] | null;
  venues: Venue;
  package_spaces: { spaces: Space }[];
}

export async function fetchPackages(): Promise<PackageRow[]> {
  const select = [
    'id', 'name', 'package_type', 'privacy_level', 'duration_hours',
    'discount_price', 'original_price', 'specialties',
    'venues(id,name,neighborhood,address,venue_type,venue_photos(image_url,is_cover))',
    'package_spaces(spaces(id,name,capacity_min,capacity_max,space_photos(image_url,is_cover)))',
  ].join(',');

  const params = new URLSearchParams({ select, is_active: 'eq.true' });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/packages?${params}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}`);
  return res.json();
}

export function toMatchedPackage(pkg: PackageRow): MatchedPackage {
  const spaces   = pkg.package_spaces.map(ps => ps.spaces).filter(Boolean);
  const capMaxes = spaces.map(s => s.capacity_max).filter((c): c is number => typeof c === 'number');
  const capMins  = spaces.map(s => s.capacity_min).filter((c): c is number => typeof c === 'number');
  const coverPhoto =
    spaces.flatMap(s => s.space_photos ?? []).find(p => p.is_cover)?.image_url ??
    spaces.flatMap(s => s.space_photos ?? [])[0]?.image_url ??
    pkg.venues.venue_photos?.find(p => p.is_cover)?.image_url ??
    pkg.venues.venue_photos?.[0]?.image_url ??
    null;

  return {
    packageId:     pkg.id,
    packageName:   pkg.name,
    packageType:   pkg.package_type,
    privacyLevel:  pkg.privacy_level,
    durationHours: pkg.duration_hours,
    price:         pkg.discount_price,
    originalPrice: pkg.original_price,
    specialties:   pkg.specialties,
    venueId:       pkg.venues.id,
    venueName:     pkg.venues.name,
    neighborhood:  pkg.venues.neighborhood,
    address:       pkg.venues.address,
    venueType:     pkg.venues.venue_type,
    capacityMin:   capMins.length  ? Math.min(...capMins)  : null,
    capacityMax:   capMaxes.length ? Math.max(...capMaxes) : null,
    coverPhoto,
  };
}

export interface BestPackageResult {
  package: MatchedPackage;
  reason:  string;
  score:   number;
}

// Returns the single highest-scoring package not already shown, or null.
export async function findBestPackage(schema: EventSchema): Promise<BestPackageResult | null> {
  const packages = await fetchPackages();

  const guestCount  = schema.guestCount.value;
  const budgetCents = schema.budget.ceiling;
  const minHours    = schema.duration.value;
  const preferred   = schema.neighborhood.preferred;
  const dealbreakers = schema.neighborhood.dealbreakers;

  const scored = packages
    .filter(pkg => !!pkg.venues)
    .map(pkg => {
      const spaces   = pkg.package_spaces.map(ps => ps.spaces).filter(Boolean);
      const capMaxes = spaces.map(s => s.capacity_max).filter((c): c is number => typeof c === 'number');
      const maxCap   = capMaxes.length ? Math.max(...capMaxes) : null;

      // Hard filters
      if (schema.packagesShown.includes(pkg.id)) return null;
      if (guestCount && maxCap !== null && maxCap < guestCount) return null;
      if (dealbreakers.includes(pkg.venues.neighborhood)) return null;

      let score = 0;
      const reasons: string[] = [];

      // Neighborhood
      if (preferred.length > 0) {
        if (preferred.includes(pkg.venues.neighborhood)) {
          score += 30;
          reasons.push(`matches your preferred neighborhood (${pkg.venues.neighborhood})`);
        } else {
          score -= 8;
        }
      }

      // Budget
      if (budgetCents !== null && pkg.discount_price !== null) {
        const budgetConf = schema.budget.flexibility === 'firm' ? 1.0
                         : schema.budget.flexibility === 'soft' ? 0.7
                         : 0.5;
        if (pkg.discount_price <= budgetCents) {
          score += Math.round(20 * budgetConf);
          if (pkg.discount_price >= budgetCents * 0.4) {
            score += Math.round(10 * budgetConf);
            reasons.push('fits your budget well');
          }
        } else {
          const overRatio = (pkg.discount_price - budgetCents) / budgetCents;
          score -= Math.round(overRatio * 30 * budgetConf);
          if (schema.budget.flexibility !== 'firm') {
            reasons.push('slightly over your ceiling — worth a look if the fit is right');
          }
        }
      }

      // Duration
      if (minHours !== null && pkg.duration_hours >= minHours) {
        score += 10;
        reasons.push(`covers your ${minHours}h duration`);
      }

      // Vibes — text match against venue_type, name, specialties
      const pkgText = `${pkg.venues.venue_type} ${pkg.name} ${(pkg.specialties ?? []).join(' ')}`.toLowerCase();
      for (const vibe of schema.vibes.liked) {
        if (pkgText.includes(vibe.toLowerCase())) { score += 8; reasons.push(`matches your vibe: ${vibe}`); }
      }
      for (const vibe of schema.vibes.disliked) {
        if (pkgText.includes(vibe.toLowerCase())) score -= 15;
      }

      // Floor plan
      const wantedPlan = schema.floorPlan.value;
      if (wantedPlan && schema.floorPlan.confidence > 0.5) {
        const planMap: Record<string, string[]> = {
          'private-room': ['private', 'exclusive'],
          'buyout':       ['buyout', 'full venue'],
          'semi-private': ['semi', 'partial'],
        };
        const keywords = planMap[wantedPlan] ?? [];
        if (keywords.some(k => pkg.privacy_level?.toLowerCase().includes(k) || pkg.name.toLowerCase().includes(k))) {
          score += 10;
        }
      }

      // Has photo (minor tie-breaker)
      const hasPhoto =
        spaces.some(s => s.space_photos?.length > 0) ||
        pkg.venues.venue_photos?.length > 0;
      if (hasPhoto) score += 2;

      // Information gain bonus in collect mode: reward packages that probe uncertain fields
      if (schema.agentMode === 'collect') {
        if (schema.indoorOutdoor.confidence < 0.5) score += 5;
        if (schema.vibes.liked.length === 0 && schema.vibes.disliked.length === 0) score += 5;
        if (schema.budget.flexibility === 'unknown' && pkg.discount_price !== null) score += 3;
      }

      const reason = reasons.length > 0
        ? reasons.join('; ')
        : `exploring options in ${pkg.venues.neighborhood}`;

      return { match: toMatchedPackage(pkg), score, reason };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;
  const top = scored[0];
  return { package: top.match, reason: top.reason, score: top.score };
}
