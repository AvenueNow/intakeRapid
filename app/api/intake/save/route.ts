import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

async function getInquiryId(sessionToken: string): Promise<string | null> {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/intake_inquiries?session_token=eq.${encodeURIComponent(sessionToken)}&select=id&limit=1`,
    {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      cache: 'no-store',
    }
  );
  if (!res.ok) return null;
  const rows = await res.json();
  return rows[0]?.id ?? null;
}

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('vh_session')?.value;
  if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { packageId } = await req.json();
  if (!packageId) return NextResponse.json({ error: 'Missing packageId' }, { status: 400 });

  const inquiryId = await getInquiryId(sessionToken);
  if (!inquiryId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await fetch(`${SUPABASE_URL}/rest/v1/intake_saved_packages`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ inquiry_id: inquiryId, package_id: packageId }),
  });

  return NextResponse.json({ saved: true });
}

export async function DELETE(req: Request) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('vh_session')?.value;
  if (!sessionToken) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { packageId } = await req.json();
  if (!packageId) return NextResponse.json({ error: 'Missing packageId' }, { status: 400 });

  const inquiryId = await getInquiryId(sessionToken);
  if (!inquiryId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await fetch(
    `${SUPABASE_URL}/rest/v1/intake_saved_packages?inquiry_id=eq.${inquiryId}&package_id=eq.${encodeURIComponent(packageId)}`,
    {
      method: 'DELETE',
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    }
  );

  return NextResponse.json({ saved: false });
}
