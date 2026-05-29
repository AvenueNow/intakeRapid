import { cookies } from 'next/headers';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

export interface SessionInquiry {
  id: string;
  slug: string;
  name: string;
  email: string;
  event_name: string;
  session_token: string;
}

export async function getSessionInquiry(): Promise<SessionInquiry | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('vh_session')?.value;
  if (!sessionToken) return null;

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/intake_inquiries?session_token=eq.${encodeURIComponent(sessionToken)}&select=id,slug,name,email,event_name,session_token&limit=1`,
    {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      cache: 'no-store',
    }
  );

  if (!res.ok) return null;
  const rows: SessionInquiry[] = await res.json();
  return rows[0] ?? null;
}
