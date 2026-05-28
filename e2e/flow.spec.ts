import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// A realistic summary that the AI would produce
const STUB_SUMMARY = {
  availability: 'Saturday June 14, 2026',
  location: 'Midtown',
  budget: '$5,000',
  eventType: 'Networking event',
  agenda: 'Cocktails, mingling, short presentations',
  duration: '3 hours',
  dietaryRestrictions: 'None',
  guestCount: '50 guests',
};

// Inject the summary into sessionStorage so we bypass the chat
async function seedSummary(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.evaluate((summary) => {
    sessionStorage.setItem('venuehopperSummary', JSON.stringify(summary));
  }, STUB_SUMMARY);
}

// Save a screenshot to test-results/screenshots/
async function screenshot(page: import('@playwright/test').Page, name: string) {
  const dir = path.join(process.cwd(), 'test-results', 'screenshots');
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: false });
}

// ── Chat page — basic ────────────────────────────────────────────────────────

test('chat page loads and shows welcome message', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=VenueHopper')).toBeVisible();
  await expect(page.locator('input[placeholder]')).toBeVisible();
  await screenshot(page, '01-chat-initial');
});

// ── Chat page — layout ───────────────────────────────────────────────────────

test('chat: card is centered and not a sliver (no panel)', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 1280, height: 800 });

  const card = page.getByTestId('chat-panel');
  await expect(card).toBeVisible();

  const box = await card.boundingBox();
  // Card should be at least 400px wide
  expect(box!.width).toBeGreaterThan(400);
  // Card should be horizontally centered: left edge > 100px on a 1280px viewport
  expect(box!.x).toBeGreaterThan(100);

  await screenshot(page, '02-chat-no-panel-1280');
});

test('chat: card fills narrow viewport correctly', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14

  const card = page.getByTestId('chat-panel');
  await expect(card).toBeVisible();

  const box = await card.boundingBox();
  // Should be nearly full-width on mobile
  expect(box!.width).toBeGreaterThan(300);
  // Should not be off-screen
  expect(box!.x).toBeGreaterThanOrEqual(0);

  await screenshot(page, '03-chat-mobile-390');
});

test('chat: split panel appears at 1280px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?dev=venues');
  await page.waitForTimeout(300); // allow state to settle

  // Panel should be visible
  const panel = page.getByTestId('venue-panel');
  await expect(panel).toBeVisible();

  // Chat should still be visible
  const chatPanel = page.getByTestId('chat-panel');
  await expect(chatPanel).toBeVisible();

  // Chat input should be accessible (not off-screen)
  const input = page.locator('input[placeholder*="message"]');
  const inputBox = await input.boundingBox();
  expect(inputBox!.x).toBeGreaterThan(0);
  expect(inputBox!.x + inputBox!.width).toBeLessThanOrEqual(1280);

  // Panel should be to the RIGHT of the chat, not overlapping
  const chatBox = await chatPanel.boundingBox();
  const panelBox = await panel.boundingBox();
  expect(panelBox!.x).toBeGreaterThan(chatBox!.x + chatBox!.width - 10); // panel starts after chat

  await screenshot(page, '04-split-panel-1280');
});

test('chat: panel hidden below 1024px (no overflow)', async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 800 });
  await page.goto('/?dev=venues');
  await page.waitForTimeout(300);

  // Panel should NOT be visible at 900px (lg breakpoint is 1024px)
  const panel = page.getByTestId('venue-panel');
  await expect(panel).not.toBeVisible();

  // Chat should be fully visible
  const chatPanel = page.getByTestId('chat-panel');
  const chatBox = await chatPanel.boundingBox();
  expect(chatBox!.x).toBeGreaterThanOrEqual(0);
  expect(chatBox!.width).toBeGreaterThan(300);

  await screenshot(page, '05-chat-900-no-panel');
});

test('chat: venue panel cards show correct content', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?dev=venues');
  await page.waitForTimeout(300);

  // Panel header
  await expect(page.locator('text=Venue options')).toBeVisible();
  await expect(page.locator('text=3 spaces matched your event')).toBeVisible();

  // Venue names from mock data
  await expect(page.locator('text=The Ginger Man')).toBeVisible();

  // Match summary (the tailored blurb)
  await expect(page.locator('text=Great for a networking crowd').first()).toBeVisible();

  // Neighborhood pill
  await expect(page.locator('text=Midtown').first()).toBeVisible();

  // Inquire buttons
  await expect(page.locator('a:has-text("Inquire →")').first()).toBeVisible();

  await screenshot(page, '06-venue-panel-content');
});

// ── buildVenueCards path ─────────────────────────────────────────────────────

test('chat: buildVenueCards — badge pill renders on cards', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?dev=cards');
  await page.waitForTimeout(300);

  // Both mock cards have badges
  await expect(page.locator('text=Best fit').first()).toBeVisible();
  await expect(page.locator('text=Under budget').first()).toBeVisible();

  await screenshot(page, '06b-buildVenueCards-badges');
});

test('chat: buildVenueCards — highlight text overrides matchSummary', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?dev=cards');
  await page.waitForTimeout(300);

  // highlight text should be shown instead of raw matchSummary
  await expect(page.locator('text=Private room fits your 50 people exactly').first()).toBeVisible();
  await expect(page.locator('text=Full buyout gives you the whole pub').first()).toBeVisible();

  // raw matchSummary strings should NOT appear (overridden by highlight)
  await expect(page.locator('text=Great for a networking crowd')).not.toBeVisible();
  await expect(page.locator('text=Polished corporate setting')).not.toBeVisible();

  await screenshot(page, '06c-buildVenueCards-highlight');
});

test('chat: buildVenueCards — panel shows 2 cards (filtered vs 3 raw)', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?dev=cards');
  await page.waitForTimeout(300);

  // MOCK_CARDS has 2 entries (agent curated), MOCK_VENUES has 3
  await expect(page.locator('text=2 spaces matched your event')).toBeVisible();

  // Turnmill (3rd raw venue) should NOT appear — not picked by agent
  await expect(page.locator('text=Turnmill Bar')).not.toBeVisible();

  await screenshot(page, '06d-buildVenueCards-count');
});

test('chat: buildVenueCards — neighborhood pill still renders alongside badge', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/?dev=cards');
  await page.waitForTimeout(300);

  // Neighborhood pill
  await expect(page.locator('text=Midtown').first()).toBeVisible();
  // Badge co-exists with neighborhood pill
  await expect(page.locator('text=Best fit').first()).toBeVisible();

  await screenshot(page, '06e-buildVenueCards-neighborhood-badge');
});

// ── Confirmation page ────────────────────────────────────────────────────────

test('confirmation page: locked state shows blurred summary + contact form', async ({ page }) => {
  await seedSummary(page);
  await page.goto('/confirmation');

  await expect(page.locator('input[placeholder="Your full name"]')).toBeVisible();
  await expect(page.locator('input[placeholder="your@email.com"]')).toBeVisible();
  await expect(page.locator('text=See venue options')).not.toBeVisible();

  await screenshot(page, '07-confirmation-locked');
});

test('confirmation page: filling contact form unlocks summary', async ({ page }) => {
  await seedSummary(page);
  await page.goto('/confirmation');

  await page.route('**/api/contact', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) })
  );

  await page.locator('input[placeholder="Your full name"]').fill('Jane Smith');
  await page.locator('input[placeholder="your@email.com"]').fill('jane@example.com');
  await page.locator('button:has-text("Unlock My Summary")').click();

  await expect(page.locator('text=See venue options')).toBeVisible({ timeout: 5000 });
  await screenshot(page, '08-confirmation-unlocked');
});

// ── Options page ─────────────────────────────────────────────────────────────

test('options page: shows venue cards when summary exists', async ({ page }) => {
  await seedSummary(page);
  await page.evaluate(() => {
    sessionStorage.setItem('venuehopperUnlocked', '1');
  });

  await page.goto('/options');

  await expect(page.locator('text=Give us 24 hours')).not.toBeVisible({ timeout: 8000 });
  await expect(page.locator('text=Here are your options')).toBeVisible({ timeout: 8000 });

  const cards = page.locator('a:has-text("Inquire about this venue")');
  await expect(cards.first()).toBeVisible();

  await screenshot(page, '09-options-with-cards');
});

test('options page: holding page shown when no summary in sessionStorage', async ({ page }) => {
  await page.goto('/options');
  await expect(page.locator('text=Give us 24 hours')).toBeVisible({ timeout: 5000 });
  await screenshot(page, '10-options-holding-page');
});

test('options page: back link returns to confirmation', async ({ page }) => {
  await seedSummary(page);
  await page.goto('/options');
  await page.locator('text=Back to my summary').click();
  await expect(page).toHaveURL(/\/confirmation/);
});
