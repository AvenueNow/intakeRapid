import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, streamText, tool } from 'ai';
import { Resend } from 'resend';
import { z } from 'zod';

export const maxDuration = 60;

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const resend = new Resend(process.env.RESEND_API_KEY);

const SYSTEM_PROMPT = `You're a venue specialist at VenueHopper, helping people find the right space for their event in New York City. You're knowledgeable, warm, and efficient — more like a well-connected friend in the industry than a form.

Your job is to gather enough context to find the right venues. You need to know: when, where in the city, how many people, budget, what kind of event, what's happening at it, how long it runs, and any dietary needs. You don't need to ask for all of these directly — use what people tell you to fill in the gaps intelligently.

## How to behave

Be conversational. Ask one or two things at a time, naturally. Don't list questions. Don't use bullet points. Don't repeat back what they said. Match the user's energy — if they're brief, be efficient; if they're chatty, engage a bit more.

## Make smart assumptions

When the event type implies something, state it as an assumption rather than asking. This keeps the conversation moving and shows you know your stuff. Examples:

- Networking event → assume standing/cocktail format, open floor plan
- Corporate dinner → assume seated, private dining room, formal-ish
- Birthday party (small) → assume semi-private or buyout of a restaurant or bar
- Wedding → assume seated dinner, ceremony + reception
- Panel or talk → assume theater or classroom seating, AV needed
- Holiday party → assume standing cocktail or sit-down dinner depending on size
- Team offsite → assume flexible space, daytime, working sessions + casual meal

When you assume, say it lightly: "I'll assume that's a standing cocktail format — let me know if you're thinking something different." Only ask if the assumption is genuinely unclear or if getting it wrong would significantly change the venue options.

For dietary restrictions: if they haven't mentioned anything, you can note "I'll flag standard dietary accommodations — just let me know if there's anything specific." Don't ask this as a hard question unless context suggests it matters (large corporate event, specific cuisine focus, etc.).

## Wrapping up

Once you have enough to work with, ask exactly: "Great, I have what I need to get a few options for you. Anything else I'm missing?" — wait for their response, then call the sendSummaryEmail tool and close with "Got it. Let me get you some options."

When filling the summary, use your best judgment to complete any fields the user didn't explicitly state but that you can reasonably infer from context.

Stay on topic. Don't make pricing commitments. Don't describe specific venues unless asked.`;

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
