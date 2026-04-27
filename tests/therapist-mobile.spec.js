import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const API_URL  = 'http://localhost:5050';

async function setup(browser) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', err => console.log('ERR:', err.message));
  const resp = await page.request.post(`${API_URL}/api/auth/login`, {
    data: { email: 'therapist@sunshine.com', password: 'Password123' }
  });
  const { token } = await resp.json();
  await page.route('/api/**', async (route) => {
    const url = route.request().url().replace('http://localhost:5173/api', `${API_URL}/api`);
    try {
      const r = await fetch(url, { method: route.request().method(), headers: { ...route.request().headers(), host: 'localhost:5050' }, body: route.request().postData() || undefined });
      await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers.entries()), body: await r.text() });
    } catch { await route.abort(); }
  });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('token', t), token);
  return page;
}

async function goToMonday(page) {
  await page.goto(`${BASE_URL}/therapist/schedule`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  // Click ">" (next week) — comes after the "Today" button
  await page.getByRole('button', { name: 'Today' }).waitFor();
  const todayBtn = page.getByRole('button', { name: 'Today' });
  // The next sibling button after Today is ">"
  const allBtns = await page.locator('button').all();
  for (let i = 0; i < allBtns.length; i++) {
    const txt = await allBtns[i].innerText().catch(() => '');
    if (txt.trim() === 'Today' && i + 1 < allBtns.length) {
      await allBtns[i + 1].click(); // ">" button
      break;
    }
  }
  await page.waitForTimeout(600);

  // Now week shows Mon Apr 27 - Sun May 3. Click the MON (first day) button.
  // Week strip buttons come after the nav row; first one is Monday
  const weekBtns = await page.locator('button').all();
  // Find button whose innerText contains "MON"
  for (const btn of weekBtns) {
    const txt = await btn.innerText().catch(() => '');
    if (txt.includes('MON')) { await btn.click(); break; }
  }
  await page.waitForTimeout(800);
}

test('day view with appointments', async ({ browser }) => {
  const page = await setup(browser);
  await goToMonday(page);
  await page.screenshot({ path: '/tmp/therapist-day.png', fullPage: true });
});

test('detail bottom sheet', async ({ browser }) => {
  const page = await setup(browser);
  await goToMonday(page);

  // Find first appointment card and click it
  const card = page.locator('button.w-full.text-left').first();
  await card.scrollIntoViewIfNeeded();
  await card.click({ force: true });
  await page.waitForTimeout(700);
  await page.screenshot({ path: '/tmp/therapist-sheet.png', fullPage: true });
});
