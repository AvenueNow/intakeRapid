const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

// ── Parsers ────────────────────────────────────────────────────────────────

function parseGuestCount(str: string): number | null {
  const nums = (str.match(/\d+/g) ?? []).map(Number);
  return nums.length ? Math.max(...nums) : null;
}

function parseBudgetCents(str: string): number | null {
  const lower = str.toLowerCase().replace(/,/g, '');
  const nums: number[] = [];
  for (const m of lower.matchAll(/\$?([\d.]+)(k)?/g)) {
    let v = parseFloat(m[1]);
    if (!v || v < 10) continue;
    if (m[2]) v *= 1000;
    nums.push(v);
  }
  return nums.length ? Math.max(...nums) * 100 : null;
}

function parseDurationHours(str: string): number | null {
  const lower = str.toLowerCase();
  if (lower.includes('half day')) return 4;
  if (lower.includes('full day')) return 8;
  const nums = (str.match(/\d+/g) ?? []).map(Number).filter(n => n > 0 && n < 24);
  return nums.length ? Math.min(...nums) : null;
}

// ── Neighborhood matching ──────────────────────────────────────────────────

const DB_NEIGHBORHOODS = [
  'Lower East Side', 'Tribeca', 'Midtown', 'SoHo', 'East Village',
  'Flatiron', "Hell's Kitchen", 'Midtown West', 'Hudson Yards',
  'Financial District', 'NoMad', 'Nolita', 'Midtown East',
];

const ALIASES: [string, string[]][] = [
  ['lower east side', ['Lower East Side']],
  ['les',             ['Lower East Side']],
  ['soho',            ['SoHo']],
  ['east village',    ['East Village']],
  ['tribeca',         ['Tribeca']],
  ['midtown west',    ['Midtown West']],
  ['midtown east',    ['Midtown East']],
  ['midtown',         ['Midtown', 'Midtown West', 'Midtown East']],
  ['flatiron',        ['Flatiron']],
  ['union square',    ['Flatiron', 'NoMad']],
  ['nomad',           ['NoMad']],
  ["hell's kitchen",  ["Hell's Kitchen"]],
  ['hells kitchen',   ["Hell's Kitchen"]],
  ['financial district', ['Financial District']],
  ['fidi',            ['Financial District']],
  ['nolita',          ['Nolita']],
  ['hudson yards',    ['Hudson Yards']],
  ['downtown',        ['Financial District', 'Tribeca', 'SoHo', 'Lower East Side', 'Nolita', 'East Village']],
  ['lower manhattan', ['Financial District', 'Tribeca']],
];

function matchNeighborhoods(location: string): string[] | null {
  const lower = location.toLowerCase();
  const matched = new Set<string>();
  for (const [alias, hoods] of ALIASES) {
    if (lower.includes(alias)) hoods.forEach(h => matched.add(h));
  }
  for (const hood of DB_NEIGHBORHOODS) {
    if (lower.includes(hood.toLowerCase())) matched.add(hood);
  }
  return matched.size > 0 ? [...matched] : null;
}

// ── Types ──────────────────────────────────────────────────────────────────

interface Photo       { image_url: string; is_cover: boolean; }
interface Space       { capacity_min: number | null; capacity_max: number | null; space_photos: Photo[]; }
interface Venue       { id: string; name: string; neighborhood: string; address: string; venue_type: string; venue_photos: Photo[]; }
interface PackageRow  {
  id: string; name: string; package_type: string; privacy_level: string;
  duration_hours: number; discount_price: number | null; original_price: number | null;
  specialties: string[] | null;
  venues: Venue;
  package_spaces: { spaces: Space }[];
}

// ── Route ──────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { summary } = await req.json();

  const guestCount   = parseGuestCount(summary.guestCount ?? '');
  const budgetCents  = parseBudgetCents(summary.budget ?? '');
  const minHours     = parseDurationHours(summary.duration ?? '');
  const neighborhoods = matchNeighborhoods(summary.location ?? '');

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

  if (!res.ok) {
    return Response.json({ error: 'DB error' }, { status: 500 });
  }

  const packages: PackageRow[] = await res.json();

  const scored = packages
    .filter(pkg => !!pkg.venues)
    .map(pkg => {
      const spaces   = pkg.package_spaces.map(ps => ps.spaces).filter(Boolean);
      const capMaxes = spaces.map(s => s.capacity_max).filter((c): c is number => typeof c === 'number');
      const maxCap   = capMaxes.length ? Math.max(...capMaxes) : null;

      // Hard filter: must fit guest count
      if (guestCount && maxCap !== null && maxCap < guestCount) return null;

      let score = 0;

      // Neighborhood
      if (neighborhoods) {
        if (neighborhoods.includes(pkg.venues.neighborhood)) score += 30;
        else score -= 8;
      }

      // Budget
      if (budgetCents !== null && pkg.discount_price !== null) {
        if (pkg.discount_price <= budgetCents) {
          score += 20;
          // Bonus for being at least half the budget (not a trivial option)
          if (pkg.discount_price >= budgetCents * 0.4) score += 10;
        } else {
          const overRatio = (pkg.discount_price - budgetCents) / budgetCents;
          score -= Math.round(overRatio * 30);
        }
      }

      // Duration
      if (minHours !== null && pkg.duration_hours >= minHours) score += 10;

      // Has cover photo (minor tie-breaker)
      const hasPhoto =
        spaces.some(s => s.space_photos?.length > 0) ||
        pkg.venues.venue_photos?.length > 0;
      if (hasPhoto) score += 2;

      return { pkg, score, maxCap };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  const matches = scored.map(({ pkg }) => {
    const spaces = pkg.package_spaces.map(ps => ps.spaces).filter(Boolean);
    const capMaxes = spaces.map(s => s.capacity_max).filter((c): c is number => typeof c === 'number');
    const capMins  = spaces.map(s => s.capacity_min).filter((c): c is number => typeof c === 'number');

    const coverPhoto =
      spaces.flatMap(s => s.space_photos ?? []).find(p => p.is_cover)?.image_url ??
      spaces.flatMap(s => s.space_photos ?? [])[0]?.image_url ??
      pkg.venues.venue_photos?.find(p => p.is_cover)?.image_url ??
      pkg.venues.venue_photos?.[0]?.image_url ??
      null;

    return {
      packageId:    pkg.id,
      packageName:  pkg.name,
      packageType:  pkg.package_type,
      privacyLevel: pkg.privacy_level,
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
  });

  return Response.json({ matches });
}
