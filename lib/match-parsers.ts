// Parsing helpers shared between /api/match and agent tools.
// All functions are pure and safe to call with null/undefined input.

export function parseGuestCount(str: string): number | null {
  const nums = (str.match(/\d+/g) ?? []).map(Number);
  return nums.length ? Math.max(...nums) : null;
}

export function parseBudgetCents(str: string): number | null {
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

export function parseDurationHours(str: string): number | null {
  const lower = str.toLowerCase();
  if (lower.includes('half day')) return 4;
  if (lower.includes('full day')) return 8;
  const nums = (str.match(/\d+/g) ?? []).map(Number).filter(n => n > 0 && n < 24);
  return nums.length ? Math.min(...nums) : null;
}

export const DB_NEIGHBORHOODS = [
  'Lower East Side', 'Tribeca', 'Midtown', 'SoHo', 'East Village',
  'Flatiron', "Hell's Kitchen", 'Midtown West', 'Hudson Yards',
  'Financial District', 'NoMad', 'Nolita', 'Midtown East',
  'Greenwich Village', 'West Village', 'Kips Bay', 'Murray Hill',
  'Upper West Side',
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
  ['greenwich village', ['Greenwich Village', 'West Village']],
  ['west village',    ['West Village']],
  ['kips bay',        ['Kips Bay']],
  ['murray hill',     ['Murray Hill', 'Kips Bay']],
  ['upper west side', ['Upper West Side']],
  ['uws',             ['Upper West Side']],
  ['downtown',        ['Financial District', 'Tribeca', 'SoHo', 'Lower East Side', 'Nolita', 'East Village']],
  ['lower manhattan', ['Financial District', 'Tribeca']],
  ['uptown',          ['Upper West Side']],
  ['village',         ['Greenwich Village', 'West Village', 'East Village']],
];

export function matchNeighborhoods(location: string): string[] | null {
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
