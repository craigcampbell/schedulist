import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:5050';

async function setupAuth(page, request) {
  const resp = await request.post(`${API_URL}/api/auth/login`, { data: { email: 'bcba@sunshine.com', password: 'Password123' } });
  const { token } = await resp.json();
  await page.route('/api/**', async (route) => {
    const url = route.request().url().replace(`${BASE_URL}/api`, `${API_URL}/api`);
    try {
      const r = await fetch(url, { method: route.request().method(), headers: { ...route.request().headers(), host: 'localhost:5050' }, body: route.request().postData() || undefined });
      await route.fulfill({ status: r.status, headers: Object.fromEntries(r.headers.entries()), body: await r.text() });
    } catch { await route.abort(); }
  });
  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate(t => localStorage.setItem('token', t), token);
}

test('Grid settings panel', async ({ page, request }) => {
  await setupAuth(page, request);
  await page.goto(`${BASE_URL}/bcba/schedule`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);

  // Navigate to a weekday
  const buttons = page.locator('button');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    if ((await buttons.nth(i).innerText().catch(() => '')).trim() === 'Today') {
      await buttons.nth(i + 1).click(); await buttons.nth(i + 1).click(); break;
    }
  }
  await page.waitForTimeout(2000);

  // Ensure Excel Grid view
  await page.locator('select').nth(1).selectOption({ value: 'grid' });
  await page.waitForTimeout(1500);

  await page.screenshot({ path: '/tmp/grid-settings-closed.png' });

  // Open settings
  await page.locator('button').filter({ hasText: /Grid/ }).click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/grid-settings-open.png' });

  // 15 min
  await page.locator('button').filter({ hasText: '15 min' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/grid-15min.png' });

  // 1 hr
  await page.locator('button').filter({ hasText: '1 hr' }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: '/tmp/grid-60min.png' });
});
