import { Resend } from 'resend';
import { NextResponse } from 'next/server';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { name, email, phone, summary } = await req.json();

  const summaryRows = summary
    ? Object.entries(summary as Record<string, string>)
        .filter(([, v]) => v)
        .map(
          ([k, v]) => `
      <tr>
        <td style="padding:8px 16px;font-weight:600;color:#374151;background:#f9fafb;width:160px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${k.replace(/([A-Z])/g, ' $1')}</td>
        <td style="padding:8px 16px;color:#111827;border-bottom:1px solid #e5e7eb;">${v}</td>
      </tr>`
        )
        .join('')
    : '';

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f3f4f6;margin:0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#C94BBE;padding:28px 32px;">
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
    await resend.emails.send({
      from: 'Intake Form <no-reply@venuehopper.com>',
      to: 'events@venuehopper.com',
      subject: `Contact Info — ${name}`,
      html,
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Contact email failed:', err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
