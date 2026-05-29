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

  const cards = page.locator('a:has-text("Inquire")');
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

// ── Options page — save / bookmark ───────────────────────────────────────────

test('options page: bookmark buttons appear on cards when inquiry slug is set', async ({ page }) => {
  await seedSummary(page);
  await page.evaluate(() => {
    sessionStorage.setItem('venuehopperInquirySlug', 'testslug123');
  });

  // Mock event fetch (no saved packages yet)
  await page.route('**/api/event/testslug123', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ inquiry: { event_name: 'Test' }, packages: [], isOwner: true }) })
  );

  await page.goto('/options');
  await expect(page.locator('text=Here are your options')).toBeVisible({ timeout: 8000 });

  // Save buttons should be visible (one per card)
  const saveButtons = page.locator('button:has-text("Save")');
  await expect(saveButtons.first()).toBeVisible();

  await screenshot(page, '11-options-bookmark-buttons');
});

test('options page: saving a venue shows sticky shortlist bar', async ({ page }) => {
  await seedSummary(page);
  await page.evaluate(() => {
    sessionStorage.setItem('venuehopperInquirySlug', 'testslug123');
  });

  await page.route('**/api/event/testslug123', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ inquiry: { event_name: 'Test' }, packages: [], isOwner: true }) })
  );
  await page.route('**/api/intake/save', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ saved: true }) })
  );

  await page.goto('/options');
  await expect(page.locator('text=Here are your options')).toBeVisible({ timeout: 8000 });

  // Click first Save button
  await page.locator('button:has-text("Save")').first().click();

  // Sticky bar should appear
  await expect(page.locator('text=venue saved')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('text=View shortlist')).toBeVisible();

  await screenshot(page, '12-options-sticky-bar');
});

test('options page: shortlist bar links to event page', async ({ page }) => {
  await seedSummary(page);
  await page.evaluate(() => {
    sessionStorage.setItem('venuehopperInquirySlug', 'myslugabc');
  });

  await page.route('**/api/event/myslugabc', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ inquiry: { event_name: 'Test' }, packages: [], isOwner: true }) })
  );
  await page.route('**/api/intake/save', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ saved: true }) })
  );

  await page.goto('/options');
  await expect(page.locator('text=Here are your options')).toBeVisible({ timeout: 8000 });
  await page.locator('button:has-text("Save")').first().click();

  const link = page.locator('a:has-text("View shortlist")');
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', '/event/myslugabc');
});

// ── Confirmation — stores inquirySlug ────────────────────────────────────────

test('confirmation page: stores inquirySlug in sessionStorage after unlock', async ({ page }) => {
  await seedSummary(page);
  await page.goto('/confirmation');

  await page.route('**/api/contact', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ success: true, inquirySlug: 'slugfromapi' }) })
  );

  await page.locator('input[placeholder="Your full name"]').fill('Jane Smith');
  await page.locator('input[placeholder="your@email.com"]').fill('jane@example.com');
  await page.locator('button:has-text("Unlock My Summary")').click();

  await expect(page.locator('text=See venue options')).toBeVisible({ timeout: 5000 });

  const slug = await page.evaluate(() => sessionStorage.getItem('venuehopperInquirySlug'));
  expect(slug).toBe('slugfromapi');

  await screenshot(page, '13-confirmation-slug-stored');
});

// ── Event page ───────────────────────────────────────────────────────────────

const STUB_PACKAGES = [{
  packageId: 'pkg-001',
  packageName: 'Private Dining Room',
  packageType: 'Starting at',
  privacyLevel: 'Private',
  durationHours: 4,
  price: 300000,
  originalPrice: null,
  specialties: ['Corporate', 'Dining'],
  venueId: 'v-001',
  venueName: 'The Grand Hall',
  neighborhood: 'Midtown',
  address: '123 Fifth Ave, New York, NY',
  venueType: 'Restaurant',
  capacityMin: 20,
  capacityMax: 80,
  coverPhoto: null,
}];

test('event page: renders saved packages publicly (no cookie)', async ({ page }) => {
  await page.route('**/api/event/pubslug99', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ inquiry: { id: '1', slug: 'pubslug99', name: 'Alex', email: 'a@b.com', event_name: 'Product Launch', summary: {}, created_at: '' }, packages: STUB_PACKAGES, isOwner: false }),
    })
  );

  await page.goto('/event/pubslug99');

  await expect(page.locator('text=Product Launch')).toBeVisible();
  await expect(page.locator('text=The Grand Hall')).toBeVisible();
  await expect(page.locator('text=1 venue saved')).toBeVisible();

  // No remove button for non-owner
  await expect(page.locator('button[title="Remove from shortlist"]')).not.toBeVisible();

  await screenshot(page, '14-event-page-public');
});

test('event page: owner sees rename button and remove buttons', async ({ page }) => {
  await page.route('**/api/event/ownslug77', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ inquiry: { id: '1', slug: 'ownslug77', name: 'Alex', email: 'a@b.com', event_name: 'My Launch', summary: {}, created_at: '' }, packages: STUB_PACKAGES, isOwner: true }),
    })
  );

  await page.goto('/event/ownslug77');

  await expect(page.locator('text=My Launch')).toBeVisible();
  // Pencil/rename button present for owner
  await expect(page.locator('button[title="Rename event"]')).toBeVisible();
  // Remove button on card
  await expect(page.locator('button[title="Remove from shortlist"]')).toBeVisible();

  await screenshot(page, '15-event-page-owner');
});

test('event page: not-found slug shows error state', async ({ page }) => {
  await page.route('**/api/event/nope000', (route) =>
    route.fulfill({ status: 404, body: JSON.stringify({ error: 'Not found' }) })
  );

  await page.goto('/event/nope000');
  await expect(page.locator('text=couldn\'t be found')).toBeVisible({ timeout: 5000 });

  await screenshot(page, '16-event-page-not-found');
});

test('event page: share button copies URL', async ({ page }) => {
  await page.route('**/api/event/shareslug', (route) =>
    route.fulfill({
      status: 200,
      body: JSON.stringify({ inquiry: { id: '1', slug: 'shareslug', name: 'Alex', email: 'a@b.com', event_name: 'My Event', summary: {}, created_at: '' }, packages: [], isOwner: true }),
    })
  );

  await page.goto('/event/shareslug');
  await expect(page.locator('text=My Event')).toBeVisible();

  // Grant clipboard permissions
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('button:has-text("Share link")').click();

  // Button should change to "Copied!"
  await expect(page.locator('button:has-text("Copied!")')).toBeVisible({ timeout: 2000 });

  await screenshot(page, '17-event-page-share-copied');
});

test('event page: owner can rename event inline', async ({ page }) => {
  await page.route('**/api/event/renameslug', async (route) => {
    if (route.request().method() === 'PATCH') {
      await route.fulfill({ status: 200, body: JSON.stringify({ success: true }) });
    } else {
      await route.fulfill({
        status: 200,
        body: JSON.stringify({ inquiry: { id: '1', slug: 'renameslug', name: 'Alex', email: 'a@b.com', event_name: 'Old Name', summary: {}, created_at: '' }, packages: [], isOwner: true }),
      });
    }
  });

  await page.goto('/event/renameslug');
  await expect(page.locator('text=Old Name')).toBeVisible();

  await page.locator('button[title="Rename event"]').click();
  await expect(page.locator('input')).toBeVisible();
  await page.locator('input').fill('New Event Name');
  await page.locator('button:has-text("Save")').click();

  await expect(page.locator('text=New Event Name')).toBeVisible({ timeout: 3000 });

  await screenshot(page, '18-event-page-renamed');
});

// ── Login page ───────────────────────────────────────────────────────────────

test('login page: renders email form', async ({ page }) => {
  await page.goto('/login');
  await expect(page.locator('text=Sign in to your shortlist')).toBeVisible();
  await expect(page.locator('input[type="email"]')).toBeVisible();
  await expect(page.locator('button:has-text("Send sign-in link")')).toBeVisible();

  await screenshot(page, '19-login-form');
});

test('login page: shows check-your-email state after submit', async ({ page }) => {
  await page.route('**/api/login', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ success: true }) })
  );

  await page.goto('/login');
  await page.locator('input[type="email"]').fill('user@example.com');
  await page.locator('button:has-text("Send sign-in link")').click();

  await expect(page.locator('text=Check your inbox')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('text=user@example.com')).toBeVisible();

  await screenshot(page, '20-login-email-sent');
});

test('login page: shows error banner for expired link', async ({ page }) => {
  await page.goto('/login?error=expired');
  await expect(page.locator('text=sign-in link has expired')).toBeVisible();

  await screenshot(page, '21-login-expired-error');
});
