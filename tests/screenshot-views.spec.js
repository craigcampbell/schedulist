import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:5050';

async function getToken(request, email, password) {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: { email, password }
  });
  const body = await response.json();
  return { token: body.token, user: body.user };
}

async function setupAuth(page, request, email = 'bcba@sunshine.com', password = 'Password123') {
  const { token, user } = await getToken(request, email, password);

  // Intercept all /api/* calls and proxy them directly to backend
  await page.route('/api/**', async (route) => {
    const url = route.request().url();
    const backendUrl = url.replace('http://localhost:5173/api', `${API_URL}/api`);
    const method = route.request().method();
    const headers = { ...route.request().headers(), host: 'localhost:5050' };
    const postData = route.request().postData();

    try {
      const response = await fetch(backendUrl, {
        method,
        headers,
        body: postData || undefined,
      });
      const body = await response.text();
      await route.fulfill({
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body,
      });
    } catch (err) {
      await route.abort();
    }
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('token', t), token);
  return { token, user };
}

test.describe('Schedule View Screenshots', () => {
  test('BCBA schedule views - all modes', async ({ page, request }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

    await setupAuth(page, request);

    // Navigate to Monday April 28 (a weekday with appointments)
    await page.goto(`${BASE_URL}/bcba/schedule`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Click Next twice to go from Sunday Apr 26 to Tuesday Apr 28
    const nextButton = page.locator('button').filter({ hasText: /^$/ }).nth(4);
    // Use keyboard shortcut or look for "Today" button and then navigate
    const todayBtn = page.locator('button:has-text("Today")').first();
    const todayBtnVisible = await todayBtn.isVisible().catch(() => false);

    // Find the next button by text/aria or by position relative to Today
    const navButtons = page.locator('button');
    const count = await navButtons.count();
    console.log('Total buttons:', count);

    // Get all button texts to find the nav ones
    for (let i = 0; i < Math.min(count, 15); i++) {
      const text = await navButtons.nth(i).innerText().catch(() => '?');
      const aria = await navButtons.nth(i).getAttribute('aria-label').catch(() => null);
      console.log(`Button ${i}: "${text}" aria="${aria}"`);
    }

    // Click Next 2 times (the button after "Today") to go to a weekday
    for (let i = 0; i < count; i++) {
      const text = await navButtons.nth(i).innerText().catch(() => '');
      if (text.trim() === 'Today') {
        await navButtons.nth(i + 1).click();
        await page.waitForTimeout(500);
        await navButtons.nth(i + 1).click();
        break;
      }
    }

    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/schedule-default.png', fullPage: true });
    console.log('Default schedule URL:', page.url());

    // ViewSelector is the 2nd select on the page (after TeamDropdown)
    const viewSelector = page.locator('select').nth(1);
    const viewSelectorVisible = await viewSelector.isVisible().catch(() => false);
    console.log('View selector visible:', viewSelectorVisible);

    const views = [
      ['grid', 'Excel Grid'],
      ['patient', 'Patient View'],
      ['lunch', 'Lunch Manager'],
      ['continuity', 'Continuity'],
      ['team', 'Team View'],
    ];

    if (viewSelectorVisible) {
      for (const [value, name] of views) {
        await viewSelector.selectOption({ value });
        await page.waitForTimeout(2500);
        await page.screenshot({ path: `/tmp/schedule-${value}.png`, fullPage: true });
        console.log(`${name} view captured`);
      }
    }

    console.log('\nJS errors:', errors.length);
    errors.slice(0, 5).forEach((e, i) => console.log(`  ${i+1}:`, e.substring(0, 200)));
  });

  test('Admin pages', async ({ page, request }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

    await setupAuth(page, request, 'admin@sunshine.com', 'Password123');

    const routes = [
      ['/admin/dashboard', 'admin-dashboard'],
      ['/admin/schedule', 'admin-schedule'],
      ['/admin/teams', 'admin-teams'],
      ['/admin/users', 'admin-users'],
      ['/admin/patients', 'admin-patients'],
      ['/admin/locations', 'admin-locations'],
    ];

    for (const [route, name] of routes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `/tmp/${name}.png`, fullPage: true });
      console.log(`${name}: ${page.url()}`);
    }

    console.log('\nAdmin errors:', errors.length);
    errors.slice(0, 5).forEach((e, i) => console.log(`  ${i+1}:`, e.substring(0, 200)));
  });

  test('Therapist views', async ({ page, request }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

    await setupAuth(page, request, 'therapist@sunshine.com', 'Password123');

    const routes = [
      ['/therapist/dashboard', 'therapist-dashboard'],
      ['/therapist/schedule', 'therapist-schedule'],
    ];

    for (const [route, name] of routes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `/tmp/${name}.png`, fullPage: true });
      console.log(`${name}: ${page.url()}`);
    }

    console.log('\nTherapist errors:', errors.length);
    errors.slice(0, 5).forEach((e, i) => console.log(`  ${i+1}:`, e.substring(0, 200)));
  });

  test('BCBA dashboard and patients', async ({ page, request }) => {
    const errors = [];
    page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

    await setupAuth(page, request);

    const routes = [
      ['/bcba/dashboard', 'bcba-dashboard'],
      ['/bcba/patients', 'bcba-patients'],
      ['/bcba/team', 'bcba-team'],
    ];

    for (const [route, name] of routes) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      await page.screenshot({ path: `/tmp/${name}.png`, fullPage: true });
      console.log(`${name}: ${page.url()}`);
    }

    console.log('\nBCBA errors:', errors.length);
    errors.slice(0, 5).forEach((e, i) => console.log(`  ${i+1}:`, e.substring(0, 200)));
  });
});
