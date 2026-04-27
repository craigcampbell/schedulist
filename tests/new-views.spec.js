import { test } from '@playwright/test';

const BASE_URL = 'http://localhost:5173';
const API_URL  = 'http://localhost:5050';

async function setup(page, request) {
  const resp = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: 'bcba@sunshine.com', password: 'Password123' }
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
}

async function goToView(page, view) {
  await page.goto(`${BASE_URL}/bcba/schedule`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1500);
  // navigate to Tue Apr 28
  const btns = page.locator('button');
  const count = await btns.count();
  for (let i = 0; i < count; i++) {
    const t = await btns.nth(i).innerText().catch(() => '');
    if (t.trim() === 'Today' && i + 1 < count) { await btns.nth(i + 1).click(); await btns.nth(i + 1).click(); break; }
  }
  await page.waitForTimeout(800);
  const sel = page.locator('select').nth(1);
  await sel.selectOption({ value: view });
  await page.waitForTimeout(3000);
}

test('team view', async ({ page, request }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await setup(page, request);
  await goToView(page, 'team');
  await page.screenshot({ path: '/tmp/new-team.png', fullPage: true });
  console.log('Team errors:', errors);
});

test('enhanced view', async ({ page, request }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await setup(page, request);
  await goToView(page, 'enhanced');
  await page.screenshot({ path: '/tmp/new-enhanced.png', fullPage: true });
  console.log('Enhanced errors:', errors);
});

test('patient view', async ({ page, request }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await setup(page, request);
  await goToView(page, 'patient');
  await page.screenshot({ path: '/tmp/new-patient.png', fullPage: true });
  console.log('Patient errors:', errors);
});
