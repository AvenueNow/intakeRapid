import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

type Part = { type: string; text?: string };
type Msg = { role: string; parts?: Part[]; content?: unknown };

export async function POST(req: Request) {
  try {
    const { messages } = await req.json() as { messages: Msg[] };
    if (!messages?.length) return new Response('ok', { status: 200 });

    const userMessages = messages.filter((m) => m.role === 'user');
    if (userMessages.length === 0) return new Response('ok', { status: 200 });

    const lines = messages
      .map((m) => {
        const label = m.role === 'user' ? 'User' : 'VenueHopper';
        const text = Array.isArray(m.parts)
          ? m.parts.filter((p) => p.type === 'text').map((p) => p.text ?? '').join('')
          : '';
        return text ? `<b>${label}:</b> ${escHtml(text)}` : null;
      })
      .filter(Boolean)
      .join('<br><br>');

    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'medium',
      timeStyle: 'short',
    });

    await resend.emails.send({
      from: 'Intake Form <no-reply@venuehopper.com>',
      to: 'events@venuehopper.com',
      subject: `Abandoned Conversation — ${userMessages.length} message${userMessages.length !== 1 ? 's' : ''} sent`,
      html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f3f4f6;margin:0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#7c3aed;padding:28px 32px;">
      <img src="https://intake-rapid.vercel.app/logo.svg" alt="VenueHopper" width="36" height="36" style="display:block;width:36px;height:36px;margin-bottom:14px;" />
      <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:600;">Abandoned Conversation</h1>
      <p style="color:#ddd6fe;margin:6px 0 0;font-size:14px;">User left before completing the intake — ${timestamp} ET</p>
    </div>
    <div style="padding:24px 32px;">
      <p style="margin:0 0 6px;color:#374151;font-size:13px;font-weight:600;">
        ${userMessages.length} user message${userMessages.length !== 1 ? 's' : ''} sent
      </p>
      <div style="font-size:14px;color:#111827;line-height:1.7;">${lines}</div>
    </div>
    <div style="padding:0 32px 20px;border-top:1px solid #e5e7eb;margin-top:16px;">
      <p style="margin:16px 0 8px;color:#374151;font-size:13px;font-weight:600;">Raw messages</p>
      <pre style="font-size:11px;color:#374151;white-space:pre-wrap;word-break:break-word;background:#f9fafb;padding:16px;border-radius:8px;">${escHtml(JSON.stringify(messages, null, 2))}</pre>
    </div>
  </div>
</body>
</html>`,
    });

    return new Response('ok', { status: 200 });
  } catch (err) {
    console.error('Abandon email failed:', err);
    return new Response('error', { status: 500 });
  }
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
