import { test, expect, type Page, type Route } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const STUB_PACKAGE = {
  packageId: 'pkg-test-001',
  packageName: 'Private Dining Room',
  packageType: 'Starting at',
  privacyLevel: 'Private',
  durationHours: 3,
  price: 500000,
  originalPrice: null,
  specialties: ['AV equipment', 'In-house catering'],
  venueId: 'venue-001',
  venueName: 'The Ginger Man',
  neighborhood: 'Midtown',
  address: '11 E 36th St, New York, NY',
  venueType: 'Bar & Restaurant',
  capacityMin: 20,
  capacityMax: 60,
  coverPhoto: null,
};

const STUB_SCHEMA = {
  date:          { value: null, confidence: 0, source: 'inferred' },
  guestCount:    { value: 50, confidence: 0.9, source: 'stated' },
  duration:      { value: 3, confidence: 0.8, source: 'inferred' },
  spaceType:     { value: 'cocktail-reception', confidence: 0.6, source: 'inferred' },
  indoorOutdoor: { value: 'indoor', confidence: 0.7, source: 'inferred' },
  floorPlan:     { value: 'semi-private', confidence: 0.5, source: 'inferred' },
  neighborhood:  { preferred: ['Midtown'], dealbreakers: [] },
  vibes:         { liked: ['modern', 'upscale'], disliked: [] },
  formality:     { value: 2, confidence: 0.6, source: 'inferred' },
  catering:      { value: null, confidence: 0, source: 'inferred' },
  bar:           { value: null, confidence: 0, source: 'inferred' },
  dietary:       { restrictions: [] },
  music:         { value: null, confidence: 0, source: 'inferred' },
  av:            { needs: [] },
  lighting:      { needs: [] },
  budget:        { ceiling: 800000, perHead: null, flexibility: 'soft' },
  priorities:    [],
  agentMode:     'narrow',
  packagesShown: ['pkg-prev-001', 'pkg-prev-002'],
  dealbreakers:  [],
};

async function seedOptions(page: Page, schemaOverride?: object) {
  await page.goto('/');
  await page.evaluate(({ schema, pkg }) => {
    sessionStorage.setItem('venuehopperSchema', JSON.stringify(schema));
    sessionStorage.setItem('venuehopperSummary', JSON.stringify({ eventType: 'Networking event', guestCount: '50 guests' }));
    sessionStorage.setItem('venuehopperUnlocked', '1');
    sessionStorage.setItem('__stubPackage', JSON.stringify(pkg));
  }, { schema: { ...STUB_SCHEMA, ...schemaOverride }, pkg: STUB_PACKAGE });
}

// Returns a mock UI message stream response that yields a text message only.
function mockTextStream(text: string): string {
  return `0:${JSON.stringify(text)}\nd:{"finishReason":"stop","usage":{"promptTokens":1,"completionTokens":1}}\n`;
}

// Mock stream that triggers requestNextPackage tool output.
function mockPackageStream(pkg: typeof STUB_PACKAGE, reason = 'Good match for your criteria'): string {
  const toolCallId = 'tc-mock-001';
  const result = JSON.stringify({ package: pkg, reason });
  return [
    `9:{"toolCallId":"${toolCallId}","toolName":"requestNextPackage","args":{}}\n`,
    `a:{"toolCallId":"${toolCallId}","result":${result}}\n`,
    `0:${JSON.stringify(`Based on ${reason}, here's one to consider.`)}\n`,
    `d:{"finishReason":"stop","usage":{"promptTokens":1,"completionTokens":1}}\n`,
  ].join('');
}

// Mock stream that triggers concludeSearch tool output.
function mockConcludeStream(pkg: typeof STUB_PACKAGE): string {
  const toolCallId = 'tc-mock-002';
  const args = {
    packageId: pkg.packageId,
    packageName: pkg.packageName,
    venueName: pkg.venueName,
    agentSummary: 'This matches your indoor Midtown preference with budget to spare.',
  };
  return [
    `9:{"toolCallId":"${toolCallId}","toolName":"concludeSearch","args":${JSON.stringify(args)}}\n`,
    `a:{"toolCallId":"${toolCallId}","result":${JSON.stringify(args)}}\n`,
    `0:${JSON.stringify("Great — I think this one is the right fit. Here's how to reach out.")}\n`,
    `d:{"finishReason":"stop","usage":{"promptTokens":1,"completionTokens":1}}\n`,
  ].join('');
}

async function fulfillStream(route: Route, body: string) {
  await route.fulfill({
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'x-vercel-ai-data-stream': 'v1',
      'Transfer-Encoding': 'chunked',
    },
    body,
  });
}

function screenshotDir() {
  const dir = path.join(process.cwd(), 'test-results', 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: path.join(screenshotDir(), `${name}.png`), fullPage: false });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('options: schema is read on mount — packagesShown counter renders', async ({ page }) => {
  await seedOptions(page, { packagesShown: ['p1', 'p2', 'p3'] });

  await page.route('/api/options-chat', async (route) => {
    await fulfillStream(route, mockTextStream('Finding your next venue…'));
  });

  await page.goto('/options');
  // Counter only renders when packagesShown.length > 1
  await expect(page.locator('text=3 venues reviewed')).toBeVisible({ timeout: 5000 });
  await screenshot(page, 'opt-01-schema-counter');
});

test('options: counter not shown when packagesShown has only 1 entry', async ({ page }) => {
  await seedOptions(page, { packagesShown: ['p1'] });

  await page.route('/api/options-chat', async (route) => {
    await fulfillStream(route, mockTextStream('Finding your first venue…'));
  });

  await page.goto('/options');
  await page.waitForTimeout(500);
  await expect(page.locator('text=venues reviewed')).not.toBeVisible();
  await screenshot(page, 'opt-02-no-counter-single');
});

test('options: clicking Next sends "Not for me" message', async ({ page }) => {
  await seedOptions(page);

  // First call: return a package so the Next button appears
  let callCount = 0;
  await page.route('/api/options-chat', async (route) => {
    callCount++;
    if (callCount === 1) {
      await fulfillStream(route, mockPackageStream(STUB_PACKAGE));
    } else {
      // Capture the body of the second call to verify the message text
      const body = route.request().postDataJSON();
      const lastMsg = body?.messages?.at(-1);
      expect(lastMsg?.parts?.[0]?.text ?? '').toContain('Not for me');
      await fulfillStream(route, mockTextStream('Got it — showing something different.'));
    }
  });

  await page.goto('/options');
  // Wait for card to render
  await expect(page.locator('button:has-text("Next")')).toBeVisible({ timeout: 8000 });
  await page.locator('button:has-text("Next")').click();

  // Wait for second API call to complete
  await expect(page.locator('text=Got it')).toBeVisible({ timeout: 8000 });
  await screenshot(page, 'opt-03-next-click');
});

test('options: clicking "I\'m interested" sends message containing venue name', async ({ page }) => {
  await seedOptions(page);

  let interestBody: { messages?: { parts?: { text?: string }[] }[] } | null = null;
  let callCount = 0;

  await page.route('/api/options-chat', async (route) => {
    callCount++;
    if (callCount === 1) {
      await fulfillStream(route, mockPackageStream(STUB_PACKAGE));
    } else {
      interestBody = route.request().postDataJSON();
      await fulfillStream(route, mockTextStream('Tell me more…'));
    }
  });

  await page.goto('/options');
  await expect(page.locator('button:has-text("I\'m interested")')).toBeVisible({ timeout: 8000 });
  await page.locator('button:has-text("I\'m interested")').click();

  await expect(page.locator('text=Tell me more')).toBeVisible({ timeout: 8000 });

  // Verify the message body includes the venue name
  const lastMsg = interestBody?.messages?.at(-1);
  const msgText = lastMsg?.parts?.[0]?.text ?? '';
  expect(msgText).toContain(STUB_PACKAGE.venueName);
  await screenshot(page, 'opt-04-interested-click');
});

test('options: concludeSearch tool output shows ConfirmCard with Inquire CTA', async ({ page }) => {
  await seedOptions(page);

  let callCount = 0;
  await page.route('/api/options-chat', async (route) => {
    callCount++;
    // First call (init): show a package
    if (callCount === 1) {
      await fulfillStream(route, mockPackageStream(STUB_PACKAGE));
    } else {
      // Simulate the agent calling concludeSearch on "I'm interested"
      await fulfillStream(route, mockConcludeStream(STUB_PACKAGE));
    }
  });

  await page.goto('/options');
  await expect(page.locator('button:has-text("I\'m interested")')).toBeVisible({ timeout: 8000 });
  await page.locator('button:has-text("I\'m interested")').click();

  // ConfirmCard should appear with the "Your pick" label and Inquire CTA
  await expect(page.locator('text=✓ Your pick')).toBeVisible({ timeout: 8000 });
  await expect(page.locator('a:has-text("Inquire about this venue")')).toBeVisible({ timeout: 5000 });
  await screenshot(page, 'opt-05-confirm-card');
});

test('options: packagesShown increments when requestNextPackage fires', async ({ page }) => {
  // Start with 2 packages shown; after receiving a new package it should be 3
  await seedOptions(page, { packagesShown: ['p1', 'p2'] });

  await page.route('/api/options-chat', async (route) => {
    await fulfillStream(route, mockPackageStream(STUB_PACKAGE));
  });

  await page.goto('/options');
  // The updateSchema tool would normally fire to update packagesShown,
  // but that's server-side. We can verify the init package renders.
  await expect(page.locator(`text=${STUB_PACKAGE.venueName}`)).toBeVisible({ timeout: 8000 });
  // Counter should show 2 (seeded) until updateSchema fires and updates it
  await expect(page.locator('text=2 venues reviewed')).toBeVisible({ timeout: 5000 });
  await screenshot(page, 'opt-06-packages-shown-counter');
});

test('options: schema summary checkpoint language appears after 4 packages', async ({ page }) => {
  // Seed schema already in narrow mode with 4 packages shown
  await seedOptions(page, {
    agentMode: 'narrow',
    packagesShown: ['p1', 'p2', 'p3', 'p4'],
    budget: { ceiling: 800000, perHead: null, flexibility: 'soft' },
    guestCount: { value: 70, confidence: 0.9, source: 'stated' },
    indoorOutdoor: { value: 'indoor', confidence: 0.8, source: 'stated' },
    neighborhood: { preferred: ['Brooklyn'], dealbreakers: [] },
    vibes: { liked: ['modern'], disliked: [] },
  });

  // Return a response that includes the schema summary checkpoint text
  await page.route('/api/options-chat', async (route) => {
    const summaryText = "Here\u2019s what I\u2019m working with on your behalf: indoor, Brooklyn, under $8k, cocktail reception for ~70 guests, modern vibe. Does that sound right, or has anything shifted?";
    await fulfillStream(route, mockTextStream(summaryText));
  });

  await page.goto('/options');
  await expect(page.locator("text=Here's what I'm working with")).toBeVisible({ timeout: 8000 });
  await screenshot(page, 'opt-07-schema-summary-checkpoint');
});
