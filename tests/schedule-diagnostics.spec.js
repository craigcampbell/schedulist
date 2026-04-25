import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';

test.describe('Schedule Page Full Diagnostics', () => {

  test('Login and navigate schedule with error capture', async ({ page }) => {
    const errors = [];
    const failedRequests = [];

    page.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));
    page.on('requestfailed', req => failedRequests.push(req.url() + ' -> ' + (req.failure()?.errorText || 'unknown')));

    // Login
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    const emailInput = page.locator('#email');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill('bcba@sunshine.com');
      await page.locator('#password').fill('Password123');
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(/\/bcba/, { timeout: 10000 });
    }

    // Navigate to schedule
    await page.goto(`${BASE_URL}/bcba/schedule`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    // Report findings
    console.log(`\n=== SCHEDULE PAGE DIAGNOSTICS ===`);
    console.log(`Current URL: ${page.url()}`);
    console.log(`Failed network requests: ${failedRequests.length}`);
    failedRequests.forEach(r => console.log(`  FAIL: ${r}`));
    console.log(`Console errors: ${errors.length}`);
    const unique = [...new Set(errors)];
    unique.forEach((e, i) => {
      const short = e.length > 200 ? e.substring(0, 200) + '...' : e;
      console.log(`  ${i + 1}. ${short}`);
    });

    // Screenshot
    await page.screenshot({ path: '/tmp/sched-diag.png', fullPage: true });
    console.log('Screenshot saved to /tmp/sched-diag.png');
  });

  test('Check if appointment form works', async ({ page }) => {
    // Login
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    const emailInput = page.locator('#email');
    if (await emailInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await emailInput.fill('bcba@sunshine.com');
      await page.locator('#password').fill('Password123');
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(/\/bcba/, { timeout: 10000 });
    }

    await page.goto(`${BASE_URL}/bcba/schedule`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Take a screenshot to see what the page looks like
    await page.screenshot({ path: '/tmp/sched-form-test.png', fullPage: true });
    
    // Check what's rendered
    const bodyText = await page.locator('body').innerText();
    console.log('Page content (first 500 chars):', bodyText.substring(0, 500));

    // Check if there's a main schedule area
    const hasGrid = await page.locator('[class*="grid"]').count();
    console.log('Grid elements found:', hasGrid);
  });

});
