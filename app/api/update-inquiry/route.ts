import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

interface Contact { name: string; email: string; phone?: string }
interface Summary { [key: string]: string | undefined }

const FIELD_LABELS: Record<string, string> = {
  eventType: 'Event Type',
  availability: 'Date(s)',
  location: 'Location',
  budget: 'Budget',
  duration: 'Duration',
  agenda: 'Agenda',
  dietaryRestrictions: 'Dietary Restrictions',
  clientName: 'Name',
  clientContact: 'Contact',
};

export async function POST(req: Request) {
  const { summary, contact }: { summary: Summary; contact: Contact } = await req.json();

  const summaryRows = Object.entries(summary)
    .filter(([, v]) => v)
    .map(([k, v]) => `
      <tr>
        <td style="padding:8px 16px;font-weight:600;color:#374151;background:#f9fafb;width:160px;border-bottom:1px solid #e5e7eb;">${FIELD_LABELS[k] ?? k}</td>
        <td style="padding:8px 16px;color:#111827;border-bottom:1px solid #e5e7eb;">${v}</td>
      </tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f3f4f6;margin:0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#C94BBE;padding:28px 32px;">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:600;">Updated Event Inquiry</h1>
      <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:14px;">${contact.name} · ${contact.email}${contact.phone ? ` · ${contact.phone}` : ''}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <tbody>${summaryRows}</tbody>
    </table>
    <div style="padding:20px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#6b7280;font-size:13px;">The client updated their inquiry via the VenueHopper intake form.</p>
    </div>
  </div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: 'Intake Form <no-reply@venuehopper.com>',
      to: 'events@venuehopper.com',
      subject: `Updated Inquiry — ${contact.name}`,
      html,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Update email failed:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
