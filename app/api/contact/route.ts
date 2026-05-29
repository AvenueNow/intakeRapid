import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);
const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

export async function POST(req: Request) {
  const { name, email, phone, summary } = await req.json();

  const FIELD_LABELS: Record<string, string> = {
    eventType: 'Event Type',
    availability: 'Date(s)',
    location: 'Location',
    budget: 'Budget',
    guestCount: 'Guest Count',
    duration: 'Duration',
    agenda: 'Agenda',
    dietaryRestrictions: 'Dietary Restrictions',
  };

  const summaryRows = summary
    ? Object.entries(summary as Record<string, string>)
        .filter(([, v]) => v)
        .map(
          ([k, v]) => `
      <tr>
        <td style="padding:8px 16px;font-weight:600;color:#374151;background:#f9fafb;width:160px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${FIELD_LABELS[k] ?? k.replace(/([A-Z])/g, ' $1')}</td>
        <td style="padding:8px 16px;color:#111827;border-bottom:1px solid #e5e7eb;">${v}</td>
      </tr>`
        )
        .join('')
    : '';

  const confirmationSummaryRows = summary
    ? Object.entries(summary as Record<string, string>)
        .filter(([k, v]) => v && FIELD_LABELS[k])
        .map(
          ([k, v]) => `
      <tr>
        <td style="padding:10px 16px;font-weight:600;color:#C94BBE;background:#fdf9ff;width:160px;border-bottom:1px solid #f0edf6;font-size:13px;">${FIELD_LABELS[k]}</td>
        <td style="padding:10px 16px;color:#111827;border-bottom:1px solid #f0edf6;font-size:14px;">${v}</td>
      </tr>`
        )
        .join('')
    : '';

  const confirmationHtml = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#F0EDF6;margin:0;padding:32px;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#C94BBE;padding:32px;">
      <img src="https://intake-rapid.vercel.app/logo.svg" alt="VenueHopper" width="36" height="36" style="display:block;width:36px;height:36px;margin-bottom:14px;" />
      <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:600;line-height:1.3;">We&apos;ve got your inquiry!</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:14px;line-height:1.6;">
        Thanks, ${name}. We&apos;ve received your event details and our team will be in touch with venue options within 24 hours.
      </p>
    </div>
    ${confirmationSummaryRows ? `
    <div style="padding:24px 32px 8px;">
      <p style="margin:0 0 12px;color:#6b7280;font-size:12px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;">Your event summary</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <tbody>${confirmationSummaryRows}</tbody>
    </table>` : ''}
    <div style="padding:24px 32px;border-top:1px solid #f0edf6;text-align:center;">
      <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.6;">
        Questions? Reply to this email or reach us at<br>
        <a href="mailto:events@venuehopper.com" style="color:#C94BBE;text-decoration:none;">events@venuehopper.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f3f4f6;margin:0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#C94BBE;padding:28px 32px;">
      <img src="https://intake-rapid.vercel.app/logo.svg" alt="VenueHopper" width="36" height="36" style="display:block;width:36px;height:36px;margin-bottom:14px;" />
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:600;">New Contact Submission</h1>
      <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:14px;">Submitted via VenueHopper intake form</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <tbody>
        <tr>
          <td style="padding:10px 16px;font-weight:600;color:#374151;background:#f9fafb;width:160px;border-bottom:1px solid #e5e7eb;">Name</td>
          <td style="padding:10px 16px;color:#111827;border-bottom:1px solid #e5e7eb;">${name}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-weight:600;color:#374151;background:#f9fafb;border-bottom:1px solid #e5e7eb;">Email</td>
          <td style="padding:10px 16px;color:#111827;border-bottom:1px solid #e5e7eb;">${email}</td>
        </tr>
        ${phone ? `<tr>
          <td style="padding:10px 16px;font-weight:600;color:#374151;background:#f9fafb;border-bottom:1px solid #e5e7eb;">Phone</td>
          <td style="padding:10px 16px;color:#111827;border-bottom:1px solid #e5e7eb;">${phone}</td>
        </tr>` : ''}
      </tbody>
    </table>
    ${summaryRows ? `
    <div style="padding:20px 32px 8px;border-top:1px solid #e5e7eb;">
      <p style="margin:0 0 12px;font-weight:600;color:#374151;font-size:13px;">EVENT DETAILS</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <tbody>${summaryRows}</tbody>
    </table>` : ''}
    <div style="padding:20px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#6b7280;font-size:13px;">Collected by your AI event planning assistant.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await Promise.all([
      resend.emails.send({
        from: 'Intake Form <no-reply@venuehopper.com>',
        to: 'events@venuehopper.com',
        subject: `Contact Info — ${name}`,
        html,
      }),
      resend.emails.send({
        from: 'VenueHopper <no-reply@venuehopper.com>',
        to: email,
        subject: 'Your VenueHopper inquiry is confirmed',
        html: confirmationHtml,
      }),
    ]);
  } catch (err) {
    console.error('Contact email failed:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }

  // Create intake inquiry (non-fatal if it fails)
  let inquirySlug: string | null = null;
  let sessionToken: string | null = null;
  try {
    const eventName = (summary as Record<string, string>)?.eventType ?? 'My Event';
    const inquiryRes = await fetch(
      `${SUPABASE_URL}/rest/v1/intake_inquiries?select=id,slug,session_token`,
      {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ name, email, phone: phone || null, event_name: eventName, summary }),
      }
    );
    if (inquiryRes.ok) {
      const rows = await inquiryRes.json();
      const inquiry = rows[0];
      if (inquiry) {
        inquirySlug = inquiry.slug;
        sessionToken = inquiry.session_token;
      }
    }
  } catch (e) {
    console.error('Failed to create intake inquiry:', e);
  }

  const response = NextResponse.json({ success: true, inquirySlug });
  if (sessionToken) {
    response.cookies.set('vh_session', sessionToken, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return response;
}
