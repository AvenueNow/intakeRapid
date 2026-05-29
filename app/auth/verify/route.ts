import { NextResponse } from 'next/server';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

export async function GET(req: Request) {
  const { searchParams, origin } = new URL(req.url);
  const token = searchParams.get('t');

  if (!token) return NextResponse.redirect(`${origin}/login?error=missing`);

  const tokenRes = await fetch(
    `${SUPABASE_URL}/rest/v1/intake_auth_tokens?token=eq.${encodeURIComponent(token)}&select=id,inquiry_id,expires_at,used&limit=1`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, cache: 'no-store' }
  );

  if (!tokenRes.ok) return NextResponse.redirect(`${origin}/login?error=invalid`);
  const tokens = await tokenRes.json();
  const authToken = tokens[0];

  if (!authToken || authToken.used || new Date(authToken.expires_at) < new Date()) {
    return NextResponse.redirect(`${origin}/login?error=expired`);
  }

  // Mark as used
  await fetch(
    `${SUPABASE_URL}/rest/v1/intake_auth_tokens?id=eq.${authToken.id}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ used: true }),
    }
  );

  const inquiryRes = await fetch(
    `${SUPABASE_URL}/rest/v1/intake_inquiries?id=eq.${authToken.inquiry_id}&select=slug,session_token&limit=1`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, cache: 'no-store' }
  );

  if (!inquiryRes.ok) return NextResponse.redirect(`${origin}/login?error=invalid`);
  const inquiries = await inquiryRes.json();
  const inquiry = inquiries[0];
  if (!inquiry) return NextResponse.redirect(`${origin}/login?error=invalid`);

  const response = NextResponse.redirect(`${origin}/event/${inquiry.slug}`);
  response.cookies.set('vh_session', inquiry.session_token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
  });
  return response;
}
