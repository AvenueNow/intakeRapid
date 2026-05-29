import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  const { email } = await req.json();
  if (!email?.trim()) return NextResponse.json({ error: 'Email required' }, { status: 400 });

  // Always return success to avoid leaking whether an email exists
  const inquiryRes = await fetch(
    `${SUPABASE_URL}/rest/v1/intake_inquiries?email=eq.${encodeURIComponent(email.trim())}&select=id,name,event_name,slug&order=created_at.desc&limit=1`,
    { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }, cache: 'no-store' }
  );

  if (!inquiryRes.ok) return NextResponse.json({ success: true });
  const inquiries = await inquiryRes.json();
  const inquiry = inquiries[0];
  if (!inquiry) return NextResponse.json({ success: true });

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const tokenRes = await fetch(
    `${SUPABASE_URL}/rest/v1/intake_auth_tokens?select=token`,
    {
      method: 'POST',
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ inquiry_id: inquiry.id, expires_at: expiresAt }),
    }
  );

  if (!tokenRes.ok) return NextResponse.json({ success: true });
  const tokens = await tokenRes.json();
  const token = tokens[0]?.token;
  if (!token) return NextResponse.json({ success: true });

  const baseUrl = new URL(req.url).origin;
  const magicLink = `${baseUrl}/auth/verify?t=${token}`;

  await resend.emails.send({
    from: 'VenueHopper <no-reply@venuehopper.com>',
    to: email.trim(),
    subject: 'Your VenueHopper sign-in link',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#F0EDF6;margin:0;padding:32px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#C94BBE;padding:28px 32px;">
      <img src="https://intake-rapid.vercel.app/logo.svg" alt="VenueHopper" width="36" height="36" style="display:block;margin-bottom:14px;" />
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:600;">Sign in to VenueHopper</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;">Hi ${inquiry.name} — click below to view your saved venue options for <strong>${inquiry.event_name}</strong>.</p>
    </div>
    <div style="padding:32px;text-align:center;">
      <a href="${magicLink}"
        style="display:inline-block;background:#C94BBE;color:#fff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:600;">
        View My Venues →
      </a>
      <p style="margin:20px 0 0;color:#9ca3af;font-size:13px;">This link expires in 1 hour and can only be used once.<br>If you didn't request this, you can safely ignore it.</p>
    </div>
    <div style="padding:0 32px 24px;border-top:1px solid #f0edf6;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">
        <a href="mailto:events@venuehopper.com" style="color:#C94BBE;text-decoration:none;">events@venuehopper.com</a>
      </p>
    </div>
  </div>
</body>
</html>`,
  });

  return NextResponse.json({ success: true });
}
