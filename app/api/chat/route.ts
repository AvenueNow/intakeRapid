import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, stepCountIs, streamText, tool } from 'ai';
import { Resend } from 'resend';
import { z } from 'zod';

export const maxDuration = 60;

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;

async function supabaseGet(path: string) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`Supabase error ${res.status}`);
  return res.json();
}

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const resend = new Resend(process.env.RESEND_API_KEY);

const SYSTEM_PROMPT = `You're V, a venue specialist at VenueHopper, helping people find event spaces in NYC.

Be conversational and quick. One or two sentences at a time — no lists, no bullets. Match the user's energy.

**Search immediately, then build cards.** On every message:
1. Call searchVenues with whatever you know (omit budgetCents if unknown)
2. Immediately call buildVenueCards — pick the 2–4 best matches, write a custom highlight for each that references the user's specific situation, and optionally add a badge ("Best fit", "Under budget", "Cozy vibe", "Outdoor space", etc.)

Re-search and re-build whenever the user gives new info. Never ask a question before searching.

Infer silently: networking → standing, corporate dinner → private room. Don't announce assumptions.

After showing options, ask at most one short follow-up to refine. Don't proactively ask about budget or date.

When the user is happy, say: "Want me to save these and send them to your email?" — then call sendSummaryEmail with everything gathered, filling gaps with your best inference.

Stay on topic. No pricing commitments.`;

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

type VenueResult = {
  venueName: string;
  address: string;
  neighborhood: string;
  venueType: string;
  spaceName: string;
  capacityMax: number | null;
  packageName: string;
  priceCents: number;
  durationHours: number;
  coverPhotoUrl: string | null;
  matchSummary: string;
  // Agent-written fields set by buildVenueCards (override matchSummary)
  highlight?: string;
  badge?: string;
};

function buildMatchSummary(
  venue: { neighborhood: string | null; venue_type: string },
  pkg: { discount_price: number | null; original_price: number | null; duration_hours: number },
  space: { capacity_max: number | null } | undefined,
  params: { guestCount: number; budgetCents: number; eventType?: string }
): string {
  const { guestCount, budgetCents, eventType } = params;
  const price = pkg.discount_price ?? pkg.original_price ?? 0;

  const et = (eventType ?? '').toLowerCase();
  let phrase1 = '';
  if (et.includes('network') || et.includes('happy hour') || et.includes('mixer') || et.includes('cocktail')) {
    phrase1 = 'Great for a casual mix-and-mingle';
  } else if (et.includes('dinner') || et.includes('dining')) {
    phrase1 = 'Ideal for a sit-down dinner';
  } else if (et.includes('birthday') || et.includes('celebration') || et.includes('party')) {
    phrase1 = 'Perfect for a private celebration';
  } else if (et.includes('corporate') || et.includes('conference') || et.includes('meeting') || et.includes('workshop') || et.includes('offsite')) {
    phrase1 = 'Polished corporate setting';
  } else if (et.includes('wedding') || et.includes('reception')) {
    phrase1 = 'Stunning event space';
  } else if (eventType) {
    phrase1 = `Solid fit for your ${eventType}`;
  } else {
    phrase1 = `A versatile ${venue.venue_type} space`;
  }

  const cap = space?.capacity_max ?? null;
  let phrase2 = '';
  if (cap && guestCount > 0) {
    if (cap >= guestCount * 1.5) {
      phrase2 = `spacious — holds up to ${cap}`;
    } else if (cap >= guestCount) {
      phrase2 = `seats your ${guestCount} comfortably`;
    }
  } else if (cap) {
    phrase2 = `up to ${cap} guests`;
  }

  if (budgetCents > 0 && price > 0 && price <= budgetCents * 0.75) {
    phrase2 = phrase2 ? `${phrase2} · well within budget` : 'well within your budget';
  }

  return phrase2 ? `${phrase1} · ${phrase2}` : phrase1;
}

export async function POST(req: Request) {
  const { messages } = await req.json();

  // Per-request cache: searchVenues stores results here so buildVenueCards
  // can look up full venue data by name without the agent re-emitting it
  let latestSearchResults: VenueResult[] = [];

  const result = streamText({
    model: anthropic('claude-opus-4-7'),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(10),
    tools: {
      searchVenues: tool<
        { guestCount: number; budgetCents?: number; neighborhood?: string; durationHours?: number; eventType?: string },
        VenueResult[]
      >({
        description:
          'Search the VenueHopper database for matching venues. Call immediately on every user message with whatever is known. budgetCents is optional — omit if unknown.',
        inputSchema: z.object({
          guestCount: z.number().describe('Number of guests — use 0 if unknown'),
          budgetCents: z.number().optional().describe('Budget in cents (e.g. $5000 = 500000) — omit if not mentioned'),
          neighborhood: z.string().optional().describe('NYC neighborhood the client prefers'),
          durationHours: z.number().optional().describe('Event duration in hours'),
          eventType: z.string().optional().describe('Type of event, e.g. "networking", "corporate dinner", "birthday party"'),
        }),
        execute: async ({ guestCount, budgetCents = 0, neighborhood, durationHours, eventType }) => {
          try {
            type Photo = { image_url: string; is_cover: boolean };
            type SpaceRow = { id: string; venue_id: string; name: string; capacity_min: number | null; capacity_max: number | null; space_photos: Photo[] };
            type VenueRow = { id: string; name: string; neighborhood: string | null; venue_type: string; address: string; venue_photos: Photo[] };
            type PkgRow   = { venue_id: string; name: string; discount_price: number | null; original_price: number | null; duration_hours: number };

            let spacesQuery = `spaces?is_active=eq.true&select=id,venue_id,name,capacity_min,capacity_max,space_photos(image_url,is_cover)`;
            if (guestCount) spacesQuery += `&capacity_max=gte.${guestCount}`;

            const spaces: SpaceRow[] = await supabaseGet(spacesQuery);
            if (!spaces.length) return [];

            const venueIds = [...new Set(spaces.map((s) => s.venue_id))];
            let venuesQuery = `venues?is_active=eq.true&select=id,name,neighborhood,venue_type,address,venue_photos(image_url,is_cover)&id=in.(${venueIds.join(',')})`;
            if (neighborhood) venuesQuery += `&neighborhood=ilike.*${encodeURIComponent(neighborhood)}*`;

            const venues: VenueRow[] = await supabaseGet(venuesQuery);
            if (!venues.length) return [];

            const matchingVenueIds = venues.map((v) => v.id);
            let pkgQuery = `packages?is_active=eq.true&select=venue_id,name,discount_price,original_price,duration_hours&venue_id=in.(${matchingVenueIds.join(',')})`;
            if (budgetCents > 0) pkgQuery += `&discount_price=lte.${budgetCents}`;
            if (durationHours)   pkgQuery += `&duration_hours=gte.${durationHours}`;

            const packages: PkgRow[] = await supabaseGet(pkgQuery);

            const venueMap = new Map(venues.map((v) => [v.id, v]));
            const spaceMap = new Map<string, SpaceRow[]>();
            for (const s of spaces) {
              if (!spaceMap.has(s.venue_id)) spaceMap.set(s.venue_id, []);
              spaceMap.get(s.venue_id)!.push(s);
            }

            const results: VenueResult[] = [];
            for (const pkg of packages.slice(0, 5)) {
              const venue = venueMap.get(pkg.venue_id);
              if (!venue) continue;
              const space = spaceMap.get(pkg.venue_id)?.[0];
              const photos = space?.space_photos ?? [];
              const coverPhotoUrl =
                photos.find(p => p.is_cover)?.image_url ??
                photos[0]?.image_url ??
                venue.venue_photos?.find(p => p.is_cover)?.image_url ??
                venue.venue_photos?.[0]?.image_url ??
                null;
              results.push({
                venueName: venue.name,
                address: venue.address,
                neighborhood: venue.neighborhood ?? '',
                venueType: venue.venue_type,
                spaceName: space?.name ?? '',
                capacityMax: space?.capacity_max ?? null,
                packageName: pkg.name,
                priceCents: pkg.discount_price ?? pkg.original_price ?? 0,
                durationHours: pkg.duration_hours,
                coverPhotoUrl,
                matchSummary: buildMatchSummary(venue, pkg, space, { guestCount, budgetCents, eventType }),
              });
            }
            latestSearchResults = results;
            return results;
          } catch (err) {
            console.error('searchVenues failed:', err);
            return [];
          }
        },
      }),

      buildVenueCards: tool<
        { cards: Array<{ venueName: string; packageName: string; highlight: string; badge?: string }> },
        VenueResult[]
      >({
        description:
          'Select and annotate venues to display to the user. Call immediately after searchVenues. Pick the 2–4 best fits, write a custom highlight for each referencing the user\'s specific needs, and optionally add a short badge.',
        inputSchema: z.object({
          cards: z.array(z.object({
            venueName:   z.string().describe('Exact venue name from searchVenues results'),
            packageName: z.string().describe('Exact package name from searchVenues results'),
            highlight:   z.string().describe('One sentence tailored to this specific user — reference their event type, guest count, vibe, or budget'),
            badge:       z.string().optional().describe('Short label: "Best fit", "Under budget", "Intimate setting", "Great for networking", etc.'),
          })),
        }),
        execute: async ({ cards }) => {
          const enriched: VenueResult[] = [];
          for (const card of cards) {
            const venue = latestSearchResults.find(
              v => v.venueName === card.venueName && v.packageName === card.packageName
            );
            if (!venue) continue;
            enriched.push({ ...venue, highlight: card.highlight, badge: card.badge });
          }
          return enriched;
        },
      }),

      sendSummaryEmail: tool<SummaryDetails, { success: boolean }>({
        description:
          'Send a summary email with all collected event details. Call this after searchVenues.',
        inputSchema: summarySchema,
        execute: async (details: SummaryDetails) => {
          try {
            const venueResults = extractVenueResults(messages);
            await resend.emails.send({
              from: 'Intake Form <no-reply@venuehopper.com>',
              to: 'events@venuehopper.com',
              subject: `New Event Inquiry — ${details.eventType}`,
              html: buildEmailHtml(details, messages, venueResults),
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

type UIMessage = { role: string; content: unknown; parts?: { type: string; text?: string; toolName?: string; output?: unknown }[] };

function extractVenueResults(messages: UIMessage[]): VenueResult[] {
  for (const msg of [...messages].reverse()) {
    if (!Array.isArray(msg.parts)) continue;
    for (const part of msg.parts) {
      if (part.toolName === 'searchVenues' && Array.isArray(part.output)) {
        return part.output as VenueResult[];
      }
    }
  }
  return [];
}

function buildTranscriptHtml(messages: UIMessage[]) {
  const lines = messages
    .map((m) => {
      const text = Array.isArray(m.parts)
        ? m.parts.filter((p) => p.type === 'text').map((p) => p.text ?? '').join('').trim()
        : '';
      if (!text) return null;
      const isUser = m.role === 'user';
      return `<div style="margin-bottom:12px;">
        <span style="font-size:11px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:${isUser ? '#C94BBE' : '#6b7280'};">${isUser ? 'Client' : 'VenueHopper'}</span>
        <p style="margin:3px 0 0;font-size:13px;color:#111827;line-height:1.6;">${text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p>
      </div>`;
    })
    .filter(Boolean)
    .join('');
  return lines
    ? `<div style="background:#f9fafb;border-radius:8px;padding:16px 20px;">${lines}</div>`
    : '<p style="color:#9ca3af;font-size:13px;">No conversation recorded.</p>';
}

function buildVenueResultsHtml(venues: VenueResult[]): string {
  if (!venues.length) return '';
  const cards = venues
    .map(
      (v) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;">
          <div style="font-weight:600;color:#111827;font-size:13px;">${v.venueName}</div>
          <div style="font-size:12px;color:#6b7280;margin-top:2px;">${v.neighborhood} · ${v.venueType}</div>
          <div style="font-size:12px;color:#6b7280;">${v.address}</div>
          <div style="font-size:12px;color:#374151;margin-top:4px;">${v.packageName} · ${v.durationHours}h · $${(v.priceCents / 100).toLocaleString()}${v.capacityMax ? ` · up to ${v.capacityMax} guests` : ''}</div>
        </td>
      </tr>`
    )
    .join('');
  return `
    <div style="padding:20px 32px 0;border-top:1px solid #e5e7eb;">
      <p style="margin:0 0 12px;color:#374151;font-size:13px;font-weight:600;">Matched Venues (${venues.length})</p>
      <table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:8px;overflow:hidden;">
        <tbody>${cards}</tbody>
      </table>
    </div>`;
}

function buildEmailHtml(details: SummaryDetails, messages: UIMessage[], venueResults: VenueResult[] = []) {
  const closingMessage: UIMessage = {
    role: 'assistant',
    content: '',
    parts: [{ type: 'text', text: 'Got it. Let me get you some options.' }],
  };
  messages = [...messages, closingMessage];
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
    ${buildVenueResultsHtml(venueResults)}
    <div style="padding:20px 32px 24px;border-top:1px solid #e5e7eb;">
      <p style="margin:0 0 16px;color:#374151;font-size:13px;font-weight:600;">Full Conversation</p>
      ${buildTranscriptHtml(messages)}
    </div>
  </div>
</body>
</html>`;
}
