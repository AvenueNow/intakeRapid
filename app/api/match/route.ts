import { type EventSchema } from '@/lib/event-schema';
import { fetchPackages, findBestPackage, toMatchedPackage } from '@/lib/score-packages';
import { parseBudgetCents, parseDurationHours, parseGuestCount, matchNeighborhoods } from '@/lib/match-parsers';

export async function POST(req: Request) {
  const body = await req.json();

  // New: POST { schema } → { package, reason }  (one package, schema-driven)
  if ('schema' in body) {
    try {
      const result = await findBestPackage(body.schema as EventSchema);
      if (!result) return Response.json({ package: null, reason: 'No packages match your current criteria.' });
      return Response.json({ package: result.package, reason: result.reason });
    } catch {
      return Response.json({ error: 'DB error' }, { status: 500 });
    }
  }

  // Legacy: POST { summary } → { matches: [...] }  (used by /options until Step 7)
  const { summary } = body as { summary: Record<string, string> };
  const guestCount    = parseGuestCount(summary.guestCount ?? '');
  const budgetCents   = parseBudgetCents(summary.budget ?? '');
  const minHours      = parseDurationHours(summary.duration ?? '');
  const neighborhoods = matchNeighborhoods(summary.location ?? '');

  let packages;
  try {
    packages = await fetchPackages();
  } catch {
    return Response.json({ error: 'DB error' }, { status: 500 });
  }

  const scored = packages
    .filter(pkg => !!pkg.venues)
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
          score -= Math.round(((pkg.discount_price - budgetCents) / budgetCents) * 30);
        }
      }
      if (minHours !== null && pkg.duration_hours >= minHours) score += 10;
      const hasPhoto =
        spaces.some(s => s.space_photos?.length > 0) || pkg.venues.venue_photos?.length > 0;
      if (hasPhoto) score += 2;
      return { pkg, score };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return Response.json({ matches: scored.map(({ pkg }) => toMatchedPackage(pkg)) });
}
