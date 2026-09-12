import { test, expect } from '@playwright/test';

test('admin login submits with CSRF validation on HTTP', async ({ page }) => {
  await page.goto('/admin/login/?next=/admin/');
  await page.getByLabel('用户名:').fill('csrf-browser-nonexistent');
  await page.getByLabel('密码:').fill('intentionally-invalid');
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/admin/login/'));
  await page.getByRole('button', { name: '登录', exact: true }).click();
  expect((await response).status()).toBe(200);
  await expect(page.locator('.errornote')).toBeVisible();
});
