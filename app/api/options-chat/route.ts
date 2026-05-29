// Options discovery chat — schema-driven, one package at a time.
// Uses updateSchema, requestNextPackage, concludeSearch tools only.
// System prompt is a placeholder; Step 8 replaces it with the full doctrine.

import { createAnthropic } from '@ai-sdk/anthropic';
import { convertToModelMessages, stepCountIs, streamText, tool } from 'ai';
import { z } from 'zod';
import { type EventSchema, type MatchedPackage, createEmptySchema } from '@/lib/event-schema';
import { findBestPackage } from '@/lib/score-packages';
import { type SchemaPatch, applyPatch, updateSchemaInputSchema } from '@/lib/schema-patch';

export const maxDuration = 60;

const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── System prompt (placeholder — refined in Step 8) ───────────────────────────

const SYSTEM_PROMPT = `You are V, a venue specialist at VenueHopper helping users find the perfect NYC event space.

You discover preferences by showing one package at a time and reading reactions. Every package you show is a probe — their reaction tells you more than any direct question.

**On every turn:**
1. Call updateSchema to record anything new you learned from the user's message.
2. Then either call requestNextPackage (to show the next venue) OR respond with a focused follow-up question — never both.

**Rules:**
- If the user message is exactly "__vh_init__", call requestNextPackage immediately with no text response.
- After showing a package, write 1–2 sentences narrating why you chose it (neighborhood, vibe, budget fit, etc.).
- If the user reacts negatively ("not for me", "don't like it", etc.), ask ONE follow-up: "What put you off — the price, neighborhood, or vibe?" Then call requestNextPackage on their next message.
- When the user expresses clear positive intent ("I like this", "this could work", "tell me more"), call concludeSearch.
- Never show more than one package per turn.
- Be concise. No lists, no bullets. One or two sentences max.
- Infer silently: "networking event" → cocktail-reception, standing; "corporate dinner" → seated-dinner, private-room. Don't ask what the user already implied.`;

// ── Route ──────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const { messages, schema: incomingSchema } = await req.json();
  let currentSchema: EventSchema = incomingSchema ?? createEmptySchema();

  const result = streamText({
    model: anthropic('claude-opus-4-7'),
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(8),
    tools: {
      updateSchema: tool<SchemaPatch, EventSchema>({
        description:
          'Update the event schema with new information learned from the user. ' +
          'Call this before requestNextPackage whenever something has changed. ' +
          'Arrays (vibesLiked, vibesDisliked, dietaryAdd) are appended — never repeat existing items. ' +
          'Use confidence 0.9+ for stated facts, 0.6–0.8 for inferred, 0.4–0.6 for probed guesses.',
        inputSchema: updateSchemaInputSchema,
        execute: async (patch) => {
          currentSchema = applyPatch(currentSchema, patch as SchemaPatch);
          return currentSchema;
        },
      }),

      requestNextPackage: tool<Record<string, never>, { package: MatchedPackage | null; reason: string }>({
        description:
          'Fetch the single best next venue package to show the user, scored against the current event schema. ' +
          'Packages already shown are automatically excluded. ' +
          'Always narrate why you chose this package in your response text.',
        inputSchema: z.object({}),
        execute: async () => {
          try {
            const result = await findBestPackage(currentSchema);
            if (!result) return { package: null, reason: 'No more packages match the current criteria.' };
            currentSchema = {
              ...currentSchema,
              packagesShown: [...currentSchema.packagesShown, result.package.packageId],
            };
            return { package: result.package, reason: result.reason };
          } catch (err) {
            console.error('requestNextPackage failed:', err);
            return { package: null, reason: 'Could not load packages right now.' };
          }
        },
      }),

      concludeSearch: tool<
        { packageId: string; packageName: string; venueName: string; agentSummary: string },
        { packageId: string; packageName: string; venueName: string; agentSummary: string }
      >({
        description:
          'Signal that the search is concluding on a specific package. ' +
          'Call this when the user expresses clear positive intent. ' +
          'The UI will display a prominent inquiry CTA. ' +
          'Also call updateSchema with agentMode: "confirm" first.',
        inputSchema: z.object({
          packageId:    z.string().describe('packageId of the finalist'),
          packageName:  z.string().describe('Package name for the CTA display'),
          venueName:    z.string().describe('Venue name for the CTA display'),
          agentSummary: z.string().describe('One sentence on why this is the right pick'),
        }),
        execute: async (args) => args,
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}
