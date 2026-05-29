import { Resend } from 'resend';
import { NextResponse } from 'next/server';
import type { EventSchema } from '@/lib/event-schema';

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

function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(cents / 100);
}

function buildSchemaBriefRows(schema: EventSchema): string {
  const rows: { label: string; value: string }[] = [];
  if (schema.budget?.ceiling) rows.push({ label: 'Budget ceiling', value: formatCents(schema.budget.ceiling) });
  if (schema.guestCount?.value) rows.push({ label: 'Guest count', value: String(schema.guestCount.value) });
  if (schema.spaceType?.value) rows.push({ label: 'Space type', value: schema.spaceType.value });
  if (schema.indoorOutdoor?.value) rows.push({ label: 'Indoor / outdoor', value: schema.indoorOutdoor.value });
  if (schema.floorPlan?.value) rows.push({ label: 'Floor plan', value: schema.floorPlan.value });
  if (schema.neighborhood?.preferred?.length) rows.push({ label: 'Preferred neighborhoods', value: schema.neighborhood.preferred.join(', ') });
  if (schema.vibes?.liked?.length) rows.push({ label: 'Vibes liked', value: schema.vibes.liked.join(', ') });
  if (schema.vibes?.disliked?.length) rows.push({ label: 'Vibes disliked', value: schema.vibes.disliked.join(', ') });
  if (schema.packagesShown?.length) rows.push({ label: 'Packages reviewed', value: String(schema.packagesShown.length) });
  if (schema.agentMode) rows.push({ label: 'Search stage', value: schema.agentMode });
  return rows.map(({ label, value }) => `
      <tr>
        <td style="padding:8px 16px;font-weight:600;color:#374151;background:#fdf9ff;width:180px;border-bottom:1px solid #e5e7eb;font-size:13px;">${label}</td>
        <td style="padding:8px 16px;color:#111827;border-bottom:1px solid #e5e7eb;font-size:13px;">${value}</td>
      </tr>`).join('');
}

export async function POST(req: Request) {
  const { summary, contact, schema }: { summary: Summary; contact: Contact; schema?: EventSchema } = await req.json();

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
      <img src="https://intake-rapid.vercel.app/logo.svg" alt="VenueHopper" width="36" height="36" style="display:block;width:36px;height:36px;margin-bottom:14px;" />
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:600;">Updated Event Inquiry</h1>
      <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:14px;">${contact.name} · ${contact.email}${contact.phone ? ` · ${contact.phone}` : ''}</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <tbody>${summaryRows}</tbody>
    </table>
    ${schema ? `
    <div style="padding:20px 32px 8px;border-top:1px solid #e5e7eb;">
      <p style="margin:0 0 12px;font-weight:600;color:#374151;font-size:13px;">AGENT EVENT BRIEF</p>
      <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;">Confirmed preferences from the venue discovery session</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <tbody>${buildSchemaBriefRows(schema)}</tbody>
    </table>` : ''}
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
