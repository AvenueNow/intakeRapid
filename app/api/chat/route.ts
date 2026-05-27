import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, streamText, tool } from 'ai';
import { Resend } from 'resend';
import { z } from 'zod';

export const maxDuration = 60;

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const resend = new Resend(process.env.RESEND_API_KEY);

const SYSTEM_PROMPT = `You're a venue specialist at VenueHopper, helping people find spaces for events in New York City.

Keep responses short — one or two sentences, two questions max at a time. No bullet points, no lists. Match the user's pace.

Infer what you can from context and just move on. If someone says networking event, you know it's standing. Corporate dinner means private room. Don't announce your assumptions — just factor them in and ask about what you still actually need. Only ask if something is genuinely ambiguous and would change the venues you'd suggest.

You need: date(s), neighborhood or part of the city, guest count, budget, and how long. Event type and what's happening usually come through naturally. Dietary needs only matter if context suggests it (large group, specific cuisine, etc.) — otherwise skip it.

Once you have enough, ask exactly: "Great, I have what I need to get a few options for you. Anything else I'm missing?" — then call sendSummaryEmail and close with "Got it. Let me get you some options."

Fill in the summary using whatever you've inferred, not just what was explicitly stated. Stay on topic. No pricing commitments.`;

const summarySchema = z.object({
  availability: z.string().describe('Date(s) the client is considering'),
  location: z.string().describe('NYC neighborhood or venue preference'),
  budget: z.string().describe('Budget range or amount'),
  eventType: z.string().describe('Type of event'),
  agenda: z.string().describe('What they want to happen at the event'),
  duration: z.string().describe('How long the event will run'),
  dietaryRestrictions: z.string().describe('Any dietary restrictions or notes'),
  guestCount: z.string().describe('Approximate number of guests'),
});

type SummaryDetails = z.infer<typeof summarySchema>;

export async function POST(req: Request) {
  const { messages } = await req.json();

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    tools: {
      sendSummaryEmail: tool<SummaryDetails, { success: boolean }>({
        description:
          'Send a summary email with all collected event details. Call this once you have gathered all required information.',
        inputSchema: summarySchema,
        execute: async (details: SummaryDetails) => {
          try {
            await resend.emails.send({
              from: 'Intake Form <no-reply@venuehopper.com>',
              to: 'events@venuehopper.com',
              subject: `New Event Inquiry — ${details.eventType}`,
              html: buildEmailHtml(details, messages),
            });
            return { success: true };
          } catch (err) {
            console.error('Email send failed:', err);
            return { success: false };
          }
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}

type UIMessage = { role: string; content: unknown };

function buildEmailHtml(details: SummaryDetails, messages: UIMessage[]) {
  const rows: [string, string][] = [
    ['Event Type', details.eventType],
    ['Availability', details.availability],
    ['Location', details.location],
    ['Budget', details.budget],
    ['Guest Count', details.guestCount],
    ['Duration', details.duration],
    ['Agenda', details.agenda],
    ['Dietary Restrictions', details.dietaryRestrictions],
  ];
  const tableRows = rows
    .map(
      ([label, value]) => `
      <tr>
        <td style="padding:10px 16px;font-weight:600;color:#374151;background:#f9fafb;width:180px;border-bottom:1px solid #e5e7eb;">${label}</td>
        <td style="padding:10px 16px;color:#111827;border-bottom:1px solid #e5e7eb;">${value}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:system-ui,sans-serif;background:#f3f4f6;margin:0;padding:32px;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#1d1d1f;padding:28px 32px;">
      <img src="https://intake-rapid.vercel.app/logo.svg" alt="VenueHopper" width="36" height="36" style="display:block;width:36px;height:36px;margin-bottom:14px;" />
      <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:600;">New Event Inquiry</h1>
      <p style="color:#9ca3af;margin:6px 0 0;font-size:14px;">Submitted via VenueHopper intake form</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <tbody>${tableRows}</tbody>
    </table>
    <div style="padding:20px 32px 8px;border-top:1px solid #e5e7eb;">
      <p style="margin:0 0 12px;color:#374151;font-size:13px;font-weight:600;">Full Conversation</p>
      <pre style="font-size:12px;color:#374151;white-space:pre-wrap;word-break:break-word;background:#f9fafb;padding:16px;border-radius:8px;overflow:auto;">${JSON.stringify(messages, null, 2)}</pre>
    </div>
  </div>
</body>
</html>`;
}
