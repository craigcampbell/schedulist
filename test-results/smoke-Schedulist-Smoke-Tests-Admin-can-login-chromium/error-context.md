# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.js >> Schedulist Smoke Tests >> Admin can login
- Location: tests/smoke.spec.js:26:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('#email, input[name="email"]').first()

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - link "DNA Manager Genetic Analysis Platform" [ref=e5] [cursor=pointer]:
      - /url: /
      - img [ref=e7]
      - generic [ref=e19]:
        - heading "DNA Manager" [level=1] [ref=e20]
        - paragraph [ref=e21]: Genetic Analysis Platform
    - navigation [ref=e22]:
      - link "Dashboard" [ref=e23] [cursor=pointer]:
        - /url: /
        - img [ref=e24]
        - text: Dashboard
      - link "Upload DNA" [ref=e26] [cursor=pointer]:
        - /url: /upload
        - img [ref=e27]
        - text: Upload DNA
  - main [ref=e30]:
    - generic [ref=e31]:
      - generic [ref=e32]:
        - generic [ref=e33]:
          - heading "Analysis Dashboard" [level=2] [ref=e34]
          - paragraph [ref=e35]: Manage DNA analyses and view results
        - button "New Analysis" [ref=e36] [cursor=pointer]:
          - img [ref=e37]
          - text: New Analysis
      - generic [ref=e41]:
        - generic [ref=e42]:
          - img [ref=e44]
          - generic [ref=e56]:
            - heading "3717335.hard-filtered.vcf.vcf" [level=4] [ref=e57]
            - generic [ref=e58]:
              - generic [ref=e59]: "#1"
              - generic [ref=e60]: 4,807,842 variants
        - generic [ref=e61]:
          - generic [ref=e62]:
            - img [ref=e63]
            - text: Variants_extracted
          - button "View" [ref=e66] [cursor=pointer]:
            - text: View
            - img [ref=e67]
          - button "Delete analysis" [ref=e71] [cursor=pointer]:
            - img [ref=e72]
  - contentinfo [ref=e75]: DNA Manager v0.1 — For research and informational purposes only. Not medical advice.
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const BASE_URL = 'http://localhost:5173';
  4  | 
  5  | test.describe('Schedulist Smoke Tests', () => {
  6  | 
  7  |   test('Login page renders', async ({ page }) => {
  8  |     await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  9  |     
  10 |     // Take screenshot to debug
  11 |     await page.screenshot({ path: '/tmp/login-page.png', fullPage: true });
  12 |     
  13 |     // Check if any form exists
  14 |     const form = page.locator('form');
  15 |     await expect(form).toBeVisible({ timeout: 10000 });
  16 |     
  17 |     // Check for email input by various selectors
  18 |     const emailInput = page.locator('#email, input[name="email"], input[type="email"]').first();
  19 |     await expect(emailInput).toBeVisible({ timeout: 5000 });
  20 |     
  21 |     // Check for password input
  22 |     const passwordInput = page.locator('#password, input[name="password"], input[type="password"]').first();
  23 |     await expect(passwordInput).toBeVisible({ timeout: 5000 });
  24 |   });
  25 | 
  26 |   test('Admin can login', async ({ page }) => {
  27 |     await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  28 |     
  29 |     const emailInput = page.locator('#email, input[name="email"]').first();
  30 |     const passwordInput = page.locator('#password, input[name="password"]').first();
  31 |     
> 32 |     await emailInput.fill('admin@sunshine.com');
     |                      ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  33 |     await passwordInput.fill('Password123');
  34 |     await page.locator('button[type="submit"]').click();
  35 |     
  36 |     // Should redirect to admin dashboard
  37 |     await page.waitForURL(/\/admin\/dashboard/, { timeout: 15000 });
  38 |   });
  39 | 
  40 |   test('API health check', async ({ request }) => {
  41 |     const response = await request.get('http://localhost:5050/');
  42 |     expect(response.status()).toBe(200);
  43 |     const text = await response.text();
  44 |     expect(text).toContain('TheraThere');
  45 |   });
  46 | 
  47 |   test('Auth API login works', async ({ request }) => {
  48 |     const response = await request.post('http://localhost:5050/api/auth/login', {
  49 |       data: {
  50 |         email: 'admin@sunshine.com',
  51 |         password: 'Password123',
  52 |         organizationSlug: 'sunshine'
  53 |       }
  54 |     });
  55 |     expect(response.status()).toBe(200);
  56 |     const body = await response.json();
  57 |     expect(body.token).toBeTruthy();
  58 |     expect(body.user).toBeTruthy();
  59 |   });
  60 | 
  61 | });
  62 | 
```