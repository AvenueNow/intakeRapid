import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, streamText, tool } from 'ai';
import { Resend } from 'resend';
import { z } from 'zod';

export const maxDuration = 60;

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const resend = new Resend(process.env.RESEND_API_KEY);

const SYSTEM_PROMPT = `You're a conversational assistant helping plan events. Collect the following from the user:

- Availability (date/s they're considering)
- Location (city or venue preference)
- Budget
- Event type (wedding, birthday, corporate, etc.)
- Agenda (what they want to happen at the event)
- Duration (how long the event will run)
- Dietary restrictions

Keep your messages short — one or two sentences max. Ask one focused question at a time and let the user do the talking. Don't summarize or repeat back what they've said. When all info is collected, call the sendSummaryEmail tool, then close briefly by saying you'll be in touch with options.

Do not ask for the client's name or contact info — only capture it if they volunteer it.

Stay on topic (event planning only). Don't make commitments. Don't tell them about package information. Focus on getting information, even ambiguously.`;

const summarySchema = z.object({
  availability: z.string().describe('Date(s) the client is considering'),
  location: z.string().describe('City or venue preference'),
  budget: z.string().describe('Budget range or amount'),
  eventType: z.string().describe('Type of event'),
  agenda: z.string().describe('What they want to happen at the event'),
  duration: z.string().describe('How long the event will run'),
  dietaryRestrictions: z.string().describe('Any dietary restrictions or notes'),
  clientName: z.string().optional().describe('Client name if mentioned'),
  clientContact: z
    .string()
    .optional()
    .describe('Client email or phone if mentioned'),
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
              html: buildEmailHtml(details),
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

function buildEmailHtml(details: SummaryDetails) {
  const rows: [string, string][] = [
    ['Event Type', details.eventType],
    ['Availability', details.availability],
    ['Location', details.location],
    ['Budget', details.budget],
    ['Duration', details.duration],
    ['Agenda', details.agenda],
    ['Dietary Restrictions', details.dietaryRestrictions],
  ];
  if (details.clientName) rows.push(['Client Name', details.clientName]);
  if (details.clientContact)
    rows.push(['Client Contact', details.clientContact]);

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
    <div style="padding:20px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#6b7280;font-size:13px;">This inquiry was collected by your AI event planning assistant.</p>
    </div>
  </div>
</body>
</html>`;
}
