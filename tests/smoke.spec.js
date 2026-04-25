import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5175';

test.describe('Schedulist Smoke Tests', () => {

  test('Login page renders', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    
    // Take screenshot to debug
    await page.screenshot({ path: '/tmp/login-page.png', fullPage: true });
    
    // Check if any form exists
    const form = page.locator('form');
    await expect(form).toBeVisible({ timeout: 10000 });
    
    // Check for email input by various selectors
    const emailInput = page.locator('#email, input[name="email"], input[type="email"]').first();
    await expect(emailInput).toBeVisible({ timeout: 5000 });
    
    // Check for password input
    const passwordInput = page.locator('#password, input[name="password"], input[type="password"]').first();
    await expect(passwordInput).toBeVisible({ timeout: 5000 });
  });

  test('Admin can login', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
    
    const emailInput = page.locator('#email, input[name="email"]').first();
    const passwordInput = page.locator('#password, input[name="password"]').first();
    
    await emailInput.fill('admin@sunshine.com');
    await passwordInput.fill('Password123');
    await page.locator('button[type="submit"]').click();
    
    // Should redirect to admin dashboard
    await page.waitForURL(/\/admin\/dashboard/, { timeout: 15000 });
  });

  test('API health check', async ({ request }) => {
    const response = await request.get('http://localhost:5050/');
    expect(response.status()).toBe(200);
    const text = await response.text();
    expect(text).toContain('TheraThere');
  });

  test('Auth API login works', async ({ request }) => {
    const response = await request.post('http://localhost:5050/api/auth/login', {
      data: {
        email: 'admin@sunshine.com',
        password: 'Password123',
        organizationSlug: 'sunshine'
      }
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.token).toBeTruthy();
    expect(body.user).toBeTruthy();
  });

});
