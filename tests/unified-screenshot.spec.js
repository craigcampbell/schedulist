import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const API_URL = 'http://localhost:5050';

test('unified subway map screenshot', async ({ page, request }) => {
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push('PAGE ERROR: ' + err.message));

  // Auth
  const resp = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: 'bcba@sunshine.com', password: 'Password123' }
  });
  const { token } = await resp.json();

  await page.route('/api/**', async (route) => {
    const url = route.request().url().replace('http://localhost:5173/api', `${API_URL}/api`);
    try {
      const response = await fetch(url, {
        method: route.request().method(),
        headers: { ...route.request().headers(), host: 'localhost:5050' },
        body: route.request().postData() || undefined,
      });
      await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers.entries()), body: await response.text() });
    } catch { await route.abort(); }
  });

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.evaluate((t) => localStorage.setItem('token', t), token);
  await page.goto(`${BASE_URL}/bcba/schedule`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Navigate forward 2 days to get to a weekday with data
  const buttons = page.locator('button');
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const text = await buttons.nth(i).innerText().catch(() => '');
    if (text.trim() === 'Today') {
      await buttons.nth(i + 1).click(); await page.waitForTimeout(400);
      await buttons.nth(i + 1).click(); await page.waitForTimeout(400);
      break;
    }
  }

  // Switch to unified view (ViewSelector is the second select after TeamDropdown)
  const sel = page.locator('select').nth(1);
  await sel.selectOption({ label: 'Unified View' });
  await page.waitForTimeout(3000);
  
  await page.screenshot({ path: '/tmp/unified-view.png', fullPage: true });
  console.log('Errors:', errors.length, errors.slice(0, 3));
  console.log('URL:', page.url());
});
