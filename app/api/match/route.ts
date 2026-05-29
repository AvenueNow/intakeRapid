import { type EventSchema, type MatchedPackage } from '@/lib/event-schema';
import { parseBudgetCents, parseDurationHours, parseGuestCount, matchNeighborhoods } from '@/lib/match-parsers';

const SUPABASE_URL      = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

// ── DB row types ───────────────────────────────────────────────────────────────

interface Photo      { image_url: string; is_cover: boolean; }
interface Space      { capacity_min: number | null; capacity_max: number | null; space_photos: Photo[]; }
interface Venue      { id: string; name: string; neighborhood: string; address: string; venue_type: string; venue_photos: Photo[]; }
interface PackageRow {
  id: string; name: string; package_type: string; privacy_level: string;
  duration_hours: number; discount_price: number | null; original_price: number | null;
  specialties: string[] | null;
  venues: Venue;
  package_spaces: { spaces: Space }[];
}

// ── Fetch all active packages from Supabase ────────────────────────────────────

async function fetchPackages(): Promise<PackageRow[]> {
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

  if (!res.ok) throw new Error('DB error');
  return res.json();
}

// ── Shape a PackageRow into the shared MatchedPackage type ────────────────────

function toMatchedPackage(pkg: PackageRow): MatchedPackage {
  const spaces    = pkg.package_spaces.map(ps => ps.spaces).filter(Boolean);
  const capMaxes  = spaces.map(s => s.capacity_max).filter((c): c is number => typeof c === 'number');
  const capMins   = spaces.map(s => s.capacity_min).filter((c): c is number => typeof c === 'number');
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

// ── Schema-driven scoring ──────────────────────────────────────────────────────
// Returns { match, score, reason } for a single package given the current schema.
// Hard filters return null (package is excluded entirely).

interface ScoredPackage {
  match:  MatchedPackage;
  score:  number;
  reason: string;
}

function scorePackage(pkg: PackageRow, schema: EventSchema): ScoredPackage | null {
  const spaces   = pkg.package_spaces.map(ps => ps.spaces).filter(Boolean);
  const capMaxes = spaces.map(s => s.capacity_max).filter((c): c is number => typeof c === 'number');
  const maxCap   = capMaxes.length ? Math.max(...capMaxes) : null;

  const guestCount  = schema.guestCount.value;
  const budgetCents = schema.budget.ceiling;
  const minHours    = schema.duration.value;
  const preferred   = schema.neighborhood.preferred;
  const dealbreaker = schema.neighborhood.dealbreakers;

  // ── Hard filters ────────────────────────────────────────────────────────────
  if (guestCount && maxCap !== null && maxCap < guestCount) return null;
  if (dealbreaker.includes(pkg.venues.neighborhood)) return null;
  if (schema.packagesShown.includes(pkg.id)) return null;

  // ── Scoring ─────────────────────────────────────────────────────────────────
  let score = 0;
  const reasons: string[] = [];

  // Neighborhood — weighted by confidence so low-confidence preferred list matters less
  const neighborhoodConf = schema.neighborhood.preferred.length > 0 ? 0.8 : 0;
  if (preferred.length > 0) {
    if (preferred.includes(pkg.venues.neighborhood)) {
      score += Math.round(30 * neighborhoodConf);
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

  // Vibes — reward packages whose venue_type or package_type overlaps liked vibes
  const likedVibes = schema.vibes.liked;
  const dislikedVibes = schema.vibes.disliked;
  const pkgText = `${pkg.venues.venue_type} ${pkg.name} ${(pkg.specialties ?? []).join(' ')}`.toLowerCase();
  for (const vibe of likedVibes) {
    if (pkgText.includes(vibe.toLowerCase())) { score += 8; reasons.push(`matches your vibe: ${vibe}`); }
  }
  for (const vibe of dislikedVibes) {
    if (pkgText.includes(vibe.toLowerCase())) { score -= 15; }
  }

  // Privacy / floor plan
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

  // ── Information gain bonus ───────────────────────────────────────────────────
  // In collect mode, reward packages that probe uncertain fields.
  // This ensures early packages test unknowns rather than just fitting knowns.
  if (schema.agentMode === 'collect') {
    if (schema.indoorOutdoor.confidence < 0.5) score += 5;  // all packages probe this
    if (schema.vibes.liked.length === 0 && schema.vibes.disliked.length === 0) score += 5;
    if (schema.budget.flexibility === 'unknown' && pkg.discount_price !== null) score += 3;
  }

  const reason = reasons.length > 0
    ? reasons.join('; ')
    : `exploring options in ${pkg.venues.neighborhood}`;

  return { match: toMatchedPackage(pkg), score, reason };
}

// ── Route ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const body = await req.json();

  // Support both call shapes during the migration period:
  //   New: { schema: EventSchema }          → returns { package, reason }
  //   Old: { summary: Record<string,string> } → returns { matches: MatchedPackage[] }
  const isSchemaRequest = 'schema' in body;

  let packages: PackageRow[];
  try {
    packages = await fetchPackages();
  } catch {
    return Response.json({ error: 'DB error' }, { status: 500 });
  }

  const validPackages = packages.filter(pkg => !!pkg.venues);

  // ── New schema-driven path ─────────────────────────────────────────────────
  if (isSchemaRequest) {
    const schema = body.schema as EventSchema;

    const scored = validPackages
      .map(pkg => scorePackage(pkg, schema))
      .filter((x): x is ScoredPackage => x !== null)
      .sort((a, b) => b.score - a.score);

    if (scored.length === 0) {
      return Response.json({ package: null, reason: 'No packages match your current criteria.' });
    }

    const top = scored[0];
    return Response.json({ package: top.match, reason: top.reason });
  }

  // ── Legacy summary path (used by /options until Step 7 lands) ─────────────
  const { summary } = body as { summary: Record<string, string> };

  const guestCount    = parseGuestCount(summary.guestCount ?? '');
  const budgetCents   = parseBudgetCents(summary.budget ?? '');
  const minHours      = parseDurationHours(summary.duration ?? '');
  const neighborhoods = matchNeighborhoods(summary.location ?? '');

  const scored = validPackages
    .map(pkg => {
      const spaces   = pkg.package_spaces.map(ps => ps.spaces).filter(Boolean);
      const capMaxes = spaces.map(s => s.capacity_max).filter((c): c is number => typeof c === 'number');
      const maxCap   = capMaxes.length ? Math.max(...capMaxes) : null;
      if (guestCount && maxCap !== null && maxCap < guestCount) return null;

      let score = 0;
      if (neighborhoods) {
        if (neighborhoods.includes(pkg.venues.neighborhood)) score += 30;
        else score -= 8;
      }
      if (budgetCents !== null && pkg.discount_price !== null) {
        if (pkg.discount_price <= budgetCents) {
          score += 20;
          if (pkg.discount_price >= budgetCents * 0.4) score += 10;
        } else {
          const overRatio = (pkg.discount_price - budgetCents) / budgetCents;
          score -= Math.round(overRatio * 30);
        }
      }
      if (minHours !== null && pkg.duration_hours >= minHours) score += 10;
      const hasPhoto =
        spaces.some(s => s.space_photos?.length > 0) ||
        pkg.venues.venue_photos?.length > 0;
      if (hasPhoto) score += 2;
      return { pkg, score };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const matches = scored.map(({ pkg }) => toMatchedPackage(pkg));
  return Response.json({ matches });
}
