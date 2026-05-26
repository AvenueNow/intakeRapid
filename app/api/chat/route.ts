import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, streamText, tool } from 'ai';
import { Resend } from 'resend';
import { z } from 'zod';

export const maxDuration = 60;

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const resend = new Resend(process.env.RESEND_API_KEY);

const SYSTEM_PROMPT = `You're a conversational assistant for VenueHopper, helping event organizers find venues in New York City. Collect the following from the user:

- Availability (date/s they're considering)
- Location (NYC neighborhood or venue preference — e.g. Brooklyn, Midtown, rooftop, waterfront)
- Budget
- Event type (wedding, birthday, corporate, etc.)
- Agenda (what they want to happen at the event)
- Duration (how long the event will run)
- Dietary restrictions
- Guest count (can be ballpark)

Be pragmatic and read the room. Default to short, focused questions — but if the user's answers are brief or sparse, bundle a few related questions together naturally, like "Got it — and roughly how many guests, what neighborhood, and what's your budget looking like?" Don't robotically ask one question at a time if you can tell the user wants to move fast. Adapt to their pace. Never repeat back what they've told you.

Once all required fields are collected, ask exactly: "Great, I have what I need to get a few options for you. Anything else I'm missing?" — wait for their response, then call the sendSummaryEmail tool and close briefly with "Got it. Let me get you some options...".

Stay on topic (event planning only). Don't make commitments. Don't tell them about package information. Focus on getting information, even ambiguously.`;

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

type UIMessage = { role: string; content: string | { type: string; text?: string }[] };

function buildTranscriptHtml(messages: UIMessage[]): string {
  const lines = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => {
      const text = Array.isArray(m.content)
        ? m.content.filter((p) => p.type === 'text').map((p) => p.text ?? '').join(' ')
        : m.content;
      const label = m.role === 'user' ? 'User' : 'Assistant';
      const bg = m.role === 'user' ? '#f9fafb' : '#ffffff';
      return `<tr><td style="padding:8px 16px;font-weight:600;color:#6b7280;width:90px;background:${bg};border-bottom:1px solid #e5e7eb;font-size:12px;vertical-align:top;">${label}</td><td style="padding:8px 16px;color:#111827;border-bottom:1px solid #e5e7eb;font-size:13px;background:${bg};white-space:pre-wrap;">${text}</td></tr>`;
    })
    .join('');
  return `<table style="width:100%;border-collapse:collapse;""><tbody>${lines}</tbody></table>`;
}

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
      <h1 style="color:#ffffff;margin:0;font-size:20px;font-weight:600;">New Event Inquiry</h1>
      <p style="color:#9ca3af;margin:6px 0 0;font-size:14px;">Submitted via VenueHopper intake form</p>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <tbody>${tableRows}</tbody>
    </table>
    <div style="padding:20px 32px 8px;border-top:1px solid #e5e7eb;">
      <p style="margin:0 0 12px;color:#374151;font-size:13px;font-weight:600;">Full Conversation</p>
      ${buildTranscriptHtml(messages)}
    </div>
  </div>
</body>
</html>`;
}
