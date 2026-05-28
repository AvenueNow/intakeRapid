import { test, expect } from '@playwright/test';

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

// ── Chat page ────────────────────────────────────────────────────────────────

test('chat page loads and shows welcome message', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('text=VenueHopper')).toBeVisible();
  // The input box should be present
  await expect(page.locator('input[placeholder]')).toBeVisible();
});

// ── Confirmation page ────────────────────────────────────────────────────────

test('confirmation page: locked state shows blurred summary + contact form', async ({ page }) => {
  await seedSummary(page);
  await page.goto('/confirmation');

  // Contact form fields
  await expect(page.locator('input[placeholder="Your full name"]')).toBeVisible();
  await expect(page.locator('input[placeholder="your@email.com"]')).toBeVisible();

  // "See venue options" button should NOT be visible yet (locked)
  await expect(page.locator('text=See venue options')).not.toBeVisible();
});

test('confirmation page: filling contact form unlocks summary', async ({ page }) => {
  await seedSummary(page);
  await page.goto('/confirmation');

  // Intercept the /api/contact POST so we don't actually send email
  await page.route('**/api/contact', (route) =>
    route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) })
  );

  // Fill contact form
  await page.locator('input[placeholder="Your full name"]').fill('Jane Smith');
  await page.locator('input[placeholder="your@email.com"]').fill('jane@example.com');

  // Submit
  await page.locator('button:has-text("Unlock My Summary")').click();

  // Should unlock — "See venue options" button appears
  await expect(page.locator('text=See venue options')).toBeVisible({ timeout: 5000 });
});

// ── Options page ─────────────────────────────────────────────────────────────

test('options page: shows venue cards when summary exists', async ({ page }) => {
  await seedSummary(page);

  // Also mark as unlocked so back-navigation works
  await page.evaluate(() => {
    sessionStorage.setItem('venuehopperUnlocked', '1');
  });

  await page.goto('/options');

  // Should NOT show the holding page
  await expect(page.locator('text=Give us 24 hours')).not.toBeVisible({ timeout: 8000 });

  // Should show results heading
  await expect(page.locator('text=Here are your options')).toBeVisible({ timeout: 8000 });

  // At least one venue card should appear
  await expect(page.locator('a:has-text("Inquire about this venue")')).toHaveCount(
    await page.locator('a:has-text("Inquire about this venue")').count()
  );
  const cards = page.locator('a:has-text("Inquire about this venue")');
  await expect(cards.first()).toBeVisible();
});

test('options page: holding page shown when no summary in sessionStorage', async ({ page }) => {
  await page.goto('/options');
  // sessionStorage is fresh — no summary
  await expect(page.locator('text=Give us 24 hours')).toBeVisible({ timeout: 5000 });
});

test('options page: back link returns to confirmation', async ({ page }) => {
  await seedSummary(page);
  await page.goto('/options');
  await page.locator('text=Back to my summary').click();
  await expect(page).toHaveURL(/\/confirmation/);
});
