import { NextResponse } from 'next/server';
import { getSessionInquiry } from '@/app/lib/session';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

const PKG_SELECT = [
  'id', 'name', 'package_type', 'privacy_level', 'duration_hours',
  'discount_price', 'original_price', 'specialties',
  'venues(id,name,neighborhood,address,venue_type,venue_photos(image_url,is_cover))',
  'package_spaces(spaces(id,name,capacity_min,capacity_max,space_photos(image_url,is_cover)))',
].join(',');

interface Photo       { image_url: string; is_cover: boolean }
interface Space       { capacity_min: number | null; capacity_max: number | null; space_photos: Photo[] }
interface Venue       { id: string; name: string; neighborhood: string; address: string; venue_type: string; venue_photos: Photo[] }
interface PackageRow  {
  id: string; name: string; package_type: string; privacy_level: string;
  duration_hours: number; discount_price: number | null; original_price: number | null;
  specialties: string[] | null;
  venues: Venue;
  package_spaces: { spaces: Space }[];
}

function toVenueMatch(pkg: PackageRow) {
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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const inquiryRes = await fetch(
    `${SUPABASE_URL}/rest/v1/intake_inquiries?slug=eq.${encodeURIComponent(slug)}&select=id,slug,name,email,event_name,summary,session_token,created_at&limit=1`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, cache: 'no-store' }
  );
  if (!inquiryRes.ok) return NextResponse.json({ error: 'DB error' }, { status: 500 });
  const inquiries = await inquiryRes.json();
  const inquiry = inquiries[0];
  if (!inquiry) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const session = await getSessionInquiry();
  const isOwner = !!session && session.id === inquiry.id;

  const { session_token: _st, ...safeInquiry } = inquiry;

  const savedRes = await fetch(
    `${SUPABASE_URL}/rest/v1/intake_saved_packages?inquiry_id=eq.${inquiry.id}&select=package_id,saved_at&order=saved_at.asc`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, cache: 'no-store' }
  );
  if (!savedRes.ok) return NextResponse.json({ inquiry: safeInquiry, packages: [], isOwner });

  const savedRows: { package_id: string }[] = await savedRes.json();
  if (savedRows.length === 0) return NextResponse.json({ inquiry: safeInquiry, packages: [], isOwner });

  const packageIds = savedRows.map(r => r.package_id);
  const pkgParams = new URLSearchParams({ select: PKG_SELECT, id: `in.(${packageIds.join(',')})`, is_active: 'eq.true' });

  const pkgRes = await fetch(
    `${SUPABASE_URL}/rest/v1/packages?${pkgParams}`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, cache: 'no-store' }
  );
  if (!pkgRes.ok) return NextResponse.json({ inquiry: safeInquiry, packages: [], isOwner });

  const pkgRows: PackageRow[] = await pkgRes.json();
  const pkgMap = new Map(pkgRows.filter(p => !!p.venues).map(p => [p.id, p]));
  const packages = packageIds.map(id => pkgMap.get(id)).filter(Boolean).map(p => toVenueMatch(p!));

  return NextResponse.json({ inquiry: safeInquiry, packages, isOwner });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const session = await getSessionInquiry();
  if (!session || session.slug !== slug) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { event_name } = await req.json();
  if (!event_name?.trim()) return NextResponse.json({ error: 'Invalid name' }, { status: 400 });

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/intake_inquiries?id=eq.${session.id}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ event_name: event_name.trim() }),
    }
  );

  if (!res.ok) return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  return NextResponse.json({ success: true });
}
