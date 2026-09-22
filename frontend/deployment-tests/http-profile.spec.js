import { test, expect } from '@playwright/test';

test('public HTTP login, child profile and activity survive missing randomUUID', async ({ page }) => {
  await page.goto('./');
  expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
  expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe('undefined');
  await page.getByLabel('手机号', { exact: true }).fill('199' + String(Date.now()).slice(-8));
  await page.getByRole('button', { name: '获取验证码', exact: true }).click();
  await page.getByLabel('验证码', { exact: true }).fill('00000');
  await page.getByRole('button', { name: '登录', exact: true }).click();
  await expect(page.getByRole('heading', { name: '建立儿童档案' })).toBeVisible();
  await page.getByLabel('姓名或称呼', { exact: true }).fill('HTTP兼容验收');
  await page.getByRole('button', { name: '保存档案', exact: true }).click();
  await expect(page.getByRole('heading', { name: '好奇心，准备出发！' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: '好奇心，准备出发！' })).toBeVisible();
  await page.goto('./#home');
  await page.getByRole('button', { name: '查看活动', exact: true }).first().click();
  await page.getByRole('button', { name: '开始活动', exact: true }).click();
  await expect(page.getByText('第 1 / 3 步', { exact: true })).toBeVisible();
});
