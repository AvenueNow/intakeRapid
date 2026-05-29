/**
 * eval-agent.ts
 *
 * Simulates real conversations with the options-chat agent and judges each
 * agent turn against the VenueHopper ideology criteria.
 *
 * Run: npx tsx scripts/eval-agent.ts
 *
 * Requires ANTHROPIC_API_KEY in env (loads .env.local automatically).
 */

import { createAnthropic } from '@ai-sdk/anthropic';
import { generateText, stepCountIs, tool } from 'ai';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// ── Load .env.local ───────────────────────────────────────────────────────────

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const [k, ...rest] = line.split('=');
    if (k && rest.length && !process.env[k.trim()]) {
      process.env[k.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  }
}

// ── Import system prompt ──────────────────────────────────────────────────────
// Dynamic import so tsx can resolve the path alias manually
const promptPath = path.join(process.cwd(), 'lib', 'options-system-prompt.ts');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { OPTIONS_SYSTEM_PROMPT } = require(promptPath) as { OPTIONS_SYSTEM_PROMPT: string };

// ── Types ─────────────────────────────────────────────────────────────────────

interface TurnResult {
  turn: number;
  userMessage: string;
  agentText: string;
  toolsCalled: string[];
  scores: CriteriaScores;
  passed: boolean;
  issues: string[];
}

interface CriteriaScores {
  narration_specific: 'pass' | 'fail' | 'na';
  deliberate_choice: 'pass' | 'fail' | 'na';
  probing_unknown: 'pass' | 'fail' | 'na';
  one_question_max: 'pass' | 'fail' | 'na';
  warm_expert_voice: 'pass' | 'fail';
  no_filler_phrases: 'pass' | 'fail';
  infers_silently: 'pass' | 'fail' | 'na';
}

interface ScenarioResult {
  scenario: string;
  seed: string;
  turns: TurnResult[];
  overallPass: boolean;
  score: number; // 0–100
}

// ── Mock package data ─────────────────────────────────────────────────────────
// Fixed packages returned by requestNextPackage so eval doesn't need Supabase.

const MOCK_PACKAGES = [
  {
    packageId: 'mock-001',
    packageName: 'Rooftop Cocktail Hour',
    packageType: 'Minimum Spend',
    privacyLevel: 'Semi-Private',
    durationHours: 3,
    price: 400000,
    originalPrice: null,
    specialties: ['Rooftop terrace', 'Full bar', 'Skyline views'],
    venueId: 'v-001',
    venueName: 'The Press Lounge',
    neighborhood: 'Hell\'s Kitchen',
    address: '653 11th Ave, New York, NY',
    venueType: 'Rooftop Bar',
    capacityMin: 30,
    capacityMax: 80,
    coverPhoto: null,
  },
  {
    packageId: 'mock-002',
    packageName: 'Private Dining Room',
    packageType: 'Starting at',
    privacyLevel: 'Private',
    durationHours: 3,
    price: 600000,
    originalPrice: null,
    specialties: ['In-house catering', 'AV equipment', 'Private entrance'],
    venueId: 'v-002',
    venueName: 'Gramercy Tavern',
    neighborhood: 'Gramercy',
    address: '42 E 20th St, New York, NY',
    venueType: 'Restaurant',
    capacityMin: 20,
    capacityMax: 50,
    coverPhoto: null,
  },
  {
    packageId: 'mock-003',
    packageName: 'Full Venue Buyout',
    packageType: 'Minimum Spend',
    privacyLevel: 'Buyout',
    durationHours: 4,
    price: 1000000,
    originalPrice: null,
    specialties: ['DJ booth', 'Full buyout', 'Custom lighting'],
    venueId: 'v-003',
    venueName: 'Wythe Hotel',
    neighborhood: 'Williamsburg',
    address: '80 Wythe Ave, Brooklyn, NY',
    venueType: 'Hotel Venue',
    capacityMin: 80,
    capacityMax: 200,
    coverPhoto: null,
  },
];

let mockPackageIndex = 0;

function getNextMockPackage() {
  const pkg = MOCK_PACKAGES[mockPackageIndex % MOCK_PACKAGES.length];
  mockPackageIndex++;
  return pkg;
}

// ── Mock tools ────────────────────────────────────────────────────────────────

function buildMockTools() {
  return {
    updateSchema: tool({
      description: 'Update the event schema with new information learned from the user.',
      inputSchema: z.object({}).passthrough(),
      execute: async () => ({ updated: true }),
    }),
    requestNextPackage: tool({
      description: 'Fetch the single best next venue package.',
      inputSchema: z.object({}),
      execute: async () => {
        const pkg = getNextMockPackage();
        return {
          package: pkg,
          reason: `${pkg.privacyLevel} ${pkg.packageName.toLowerCase()} in ${pkg.neighborhood}, ${pkg.price ? `$${(pkg.price / 100).toLocaleString()} minimum` : 'price on request'}, up to ${pkg.capacityMax} guests.`,
        };
      },
    }),
    concludeSearch: tool({
      description: 'Signal that the search is concluding on a specific package.',
      inputSchema: z.object({
        packageId: z.string(),
        packageName: z.string(),
        venueName: z.string(),
        agentSummary: z.string(),
      }),
      execute: async (args) => args,
    }),
  };
}

// ── Ideology judge ────────────────────────────────────────────────────────────

const JUDGE_PROMPT = `You are evaluating whether a venue-search AI agent named V is following its design ideology correctly.

The agent's core philosophy:
- Every package shown is a DELIBERATE PROBE, not a random result. The agent chooses what to show intentionally.
- The agent is a KNOWLEDGEABLE EXPERT who surfaces considerations the client hasn't thought about yet.
- The agent sounds like a well-connected friend, not a search engine.
- The narration after showing a package must reference SPECIFIC attributes (neighborhood, privacy level, price, why this was chosen now).
- The agent should NEVER sound careless, automated, or like it's just returning search results.

FORBIDDEN phrases / patterns (automatic fail):
- "I threw together", "I pulled together", "here are some options"
- "Let me know what you think", "hope this helps", "feel free to"
- Generic narration that doesn't reference why THIS package was chosen
- Asking multiple questions in one turn
- Sounding like a chatbot form-filler rather than an expert

GOOD patterns:
- Narration references specific package attributes and explains the deliberate probe rationale
- Agent surfaces an important dimension the client hasn't thought about (exclusivity, AV, catering, formality, outdoor tolerance)
- One clear question when asking, and only when it genuinely adds value
- Warm but expert — brings knowledge to the conversation

Evaluate the agent's response and return a JSON object with this exact shape:
{
  "narration_specific": "pass" | "fail" | "na",   // na if no package was shown
  "deliberate_choice": "pass" | "fail" | "na",    // na if no package was shown
  "probing_unknown": "pass" | "fail" | "na",      // na if it's not the right moment to probe
  "one_question_max": "pass" | "fail" | "na",     // na if no question was asked
  "warm_expert_voice": "pass" | "fail",
  "no_filler_phrases": "pass" | "fail",
  "infers_silently": "pass" | "fail" | "na",      // na if no event type was mentioned
  "issues": ["specific issue 1", "specific issue 2"],  // empty array if all pass
  "overall": "pass" | "fail"
}

Return ONLY valid JSON, no explanation outside the JSON.`;

async function judgeResponse(
  anthropic: ReturnType<typeof createAnthropic>,
  userMessage: string,
  agentText: string,
  toolsCalled: string[],
  scenarioContext: string,
): Promise<{ scores: CriteriaScores; passed: boolean; issues: string[] }> {
  const prompt = `SCENARIO CONTEXT: ${scenarioContext}

USER MESSAGE: "${userMessage}"

AGENT TEXT RESPONSE: "${agentText}"

TOOLS THE AGENT CALLED THIS TURN: ${toolsCalled.length ? toolsCalled.join(', ') : 'none'}

Evaluate the agent's response against the ideology criteria.`;

  const { text } = await generateText({
    model: anthropic('claude-haiku-4-5-20251001'),
    system: JUDGE_PROMPT,
    prompt,
    temperature: 0,
  });

  try {
    // Strip any markdown code fences the model might add
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned) as CriteriaScores & { issues: string[]; overall: string };
    const { issues, overall, ...scores } = result;
    return { scores: scores as CriteriaScores, passed: overall === 'pass', issues: issues ?? [] };
  } catch {
    return {
      scores: {
        narration_specific: 'na',
        deliberate_choice: 'na',
        probing_unknown: 'na',
        one_question_max: 'na',
        warm_expert_voice: 'fail',
        no_filler_phrases: 'fail',
        infers_silently: 'na',
      },
      passed: false,
      issues: [`Judge parse error — raw response: ${text.slice(0, 200)}`],
    };
  }
}

// ── Scenario runner ───────────────────────────────────────────────────────────

interface Scenario {
  name: string;
  turns: string[];  // user messages in order
}

const SCENARIOS: Scenario[] = [
  {
    name: 'Happy hour — vague start',
    turns: [
      '__vh_init__',
      'happy hour for my team',
      'not really my vibe, a bit too exposed',
      'budget is around $3k, maybe 25 people',
    ],
  },
  {
    name: 'Corporate dinner — explicit',
    turns: [
      '__vh_init__',
      'corporate dinner for 40 people, Midtown, our budget is $8k',
      'interesting, but can we go somewhere more private?',
      'this could work actually, tell me more',
    ],
  },
  {
    name: 'Birthday party — unknown budget',
    turns: [
      '__vh_init__',
      'birthday party in Brooklyn',
      'I like this vibe but not sure about the price',
      'are there options with a DJ included?',
    ],
  },
  {
    name: 'Product launch — no details yet',
    turns: [
      '__vh_init__',
      'product launch event',
      'we need to be able to do a presentation',
      'around 60 people, Manhattan preferred',
    ],
  },
];

async function runScenario(
  anthropicClient: ReturnType<typeof createAnthropic>,
  scenario: Scenario,
): Promise<ScenarioResult> {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`SCENARIO: ${scenario.name}`);
  console.log('═'.repeat(60));

  const turnResults: TurnResult[] = [];
  const conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];
  mockPackageIndex = 0; // reset mock index per scenario

  for (let i = 0; i < scenario.turns.length; i++) {
    const userMessage = scenario.turns[i];
    const isInit = userMessage === '__vh_init__';

    conversationHistory.push({ role: 'user', content: userMessage });

    const toolsCalled: string[] = [];

    const { text } = await generateText({
      model: anthropicClient('claude-sonnet-4-6'),
      system: OPTIONS_SYSTEM_PROMPT,
      messages: conversationHistory,
      tools: buildMockTools(),
      stopWhen: stepCountIs(5),
      onStepFinish: (step) => {
        for (const tc of (step.toolCalls ?? [])) {
          toolsCalled.push((tc as { toolName: string }).toolName);
        }
      },
    });

    // Anthropic rejects empty content blocks — use a space if agent produced no text
    conversationHistory.push({ role: 'assistant', content: text.trim() || '…' });

    const displayMsg = isInit ? '[INIT TRIGGER]' : userMessage;
    console.log(`\nTurn ${i + 1}: User: "${displayMsg}"`);
    console.log(`Agent: "${text.slice(0, 200)}${text.length > 200 ? '…' : ''}"`);
    console.log(`Tools: [${toolsCalled.join(', ') || 'none'}]`);

    // Don't judge the init turn's text (it should be empty)
    let judgeResult: { scores: CriteriaScores; passed: boolean; issues: string[] };

    if (isInit && !text.trim()) {
      // Correct — init should produce no text
      judgeResult = {
        scores: {
          narration_specific: 'na',
          deliberate_choice: 'na',
          probing_unknown: 'na',
          one_question_max: 'na',
          warm_expert_voice: 'pass',
          no_filler_phrases: 'pass',
          infers_silently: 'na',
        },
        passed: true,
        issues: [],
      };
    } else {
      judgeResult = await judgeResponse(
        anthropicClient,
        displayMsg,
        text,
        toolsCalled,
        `Scenario: "${scenario.name}". Turn ${i + 1} of ${scenario.turns.length}.`,
      );
    }

    const statusEmoji = judgeResult.passed ? '✅' : '❌';
    console.log(`${statusEmoji} Judge: ${judgeResult.passed ? 'PASS' : 'FAIL'}`);
    if (judgeResult.issues.length > 0) {
      for (const issue of judgeResult.issues) {
        console.log(`   ⚠  ${issue}`);
      }
    }

    turnResults.push({
      turn: i + 1,
      userMessage: displayMsg,
      agentText: text,
      toolsCalled,
      scores: judgeResult.scores,
      passed: judgeResult.passed,
      issues: judgeResult.issues,
    });
  }

  const passCount = turnResults.filter(t => t.passed).length;
  const score = Math.round((passCount / turnResults.length) * 100);

  console.log(`\nScenario score: ${passCount}/${turnResults.length} turns passed (${score}%)`);

  return {
    scenario: scenario.name,
    seed: scenario.turns[1] ?? '',
    turns: turnResults,
    overallPass: score >= 75,
    score,
  };
}

// ── Report writer ─────────────────────────────────────────────────────────────

function writeReport(results: ScenarioResult[]) {
  const totalTurns = results.flatMap(r => r.turns).length;
  const passedTurns = results.flatMap(r => r.turns).filter(t => t.passed).length;
  const overallScore = Math.round((passedTurns / totalTurns) * 100);

  const lines: string[] = [
    '# Agent Ideology Eval Report',
    `Generated: ${new Date().toISOString()}`,
    '',
    `## Overall: ${passedTurns}/${totalTurns} turns passed — ${overallScore}%`,
    '',
  ];

  for (const scenario of results) {
    lines.push(`### ${scenario.overallPass ? '✅' : '❌'} ${scenario.scenario} (${scenario.score}%)`);
    lines.push('');
    for (const turn of scenario.turns) {
      const icon = turn.passed ? '✅' : '❌';
      lines.push(`**Turn ${turn.turn}** ${icon} — User: "${turn.userMessage.slice(0, 60)}"`);
      lines.push(`> Agent: "${turn.agentText.slice(0, 120)}${turn.agentText.length > 120 ? '…' : ''}"`);
      lines.push(`> Tools: [${turn.toolsCalled.join(', ') || 'none'}]`);
      if (turn.issues.length > 0) {
        for (const issue of turn.issues) {
          lines.push(`> ⚠ ${issue}`);
        }
      }
      // Criteria breakdown
      const criteria = Object.entries(turn.scores)
        .filter(([, v]) => v !== 'na')
        .map(([k, v]) => `${v === 'pass' ? '✓' : '✗'} ${k}`)
        .join(' · ');
      if (criteria) lines.push(`> ${criteria}`);
      lines.push('');
    }
  }

  // Aggregate failures
  const allIssues = results
    .flatMap(r => r.turns)
    .flatMap(t => t.issues);

  if (allIssues.length > 0) {
    lines.push('## Issues found');
    lines.push('');
    for (const issue of allIssues) {
      lines.push(`- ${issue}`);
    }
  }

  const outPath = path.join(process.cwd(), 'test-results', 'agent-eval.md');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`\nReport written to ${outPath}`);
  return overallScore;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY not set');
    process.exit(1);
  }

  const anthropicClient = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  console.log('VenueHopper Agent Ideology Eval');
  console.log(`Scenarios: ${SCENARIOS.length} · Model: claude-sonnet-4-6 · Judge: claude-haiku-4-5`);

  const results: ScenarioResult[] = [];

  for (const scenario of SCENARIOS) {
    const result = await runScenario(anthropicClient, scenario);
    results.push(result);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('SUMMARY');
  console.log('═'.repeat(60));
  for (const r of results) {
    console.log(`${r.overallPass ? '✅' : '❌'} ${r.scenario}: ${r.score}%`);
  }

  const overallScore = writeReport(results);
  console.log(`\nOverall score: ${overallScore}%`);

  if (overallScore < 70) {
    console.log('\n⚠  Score below 70% — review test-results/agent-eval.md for issues');
    process.exit(1);
  } else {
    console.log('\n✅ Agent passing ideology criteria');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
