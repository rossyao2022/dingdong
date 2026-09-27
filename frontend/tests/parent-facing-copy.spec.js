import { test, expect } from "@playwright/test";

const phone = () => "199" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");

async function login(page) {
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill(phone());
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page.getByRole("heading", { name: "建立儿童档案" })).toBeVisible();
}

test("家长在建档页可直接退出", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#logout-shortcut")).toBeHidden();
  await login(page);
  await expect(page.locator("#logout-shortcut")).toBeVisible();
  await page.locator("#logout-shortcut").click();
  await expect(page.getByRole("heading", { name: "家长登录" })).toBeVisible();
  await expect(page.locator("#logout-shortcut")).toBeHidden();
});

test("家长页面不显示内部说明，手机上也能退出", async ({ page }) => {
  await login(page);
  await page.getByLabel("姓名或称呼").fill("文案验收儿童");
  await page.getByRole("button", { name: "保存档案" }).click();
  await expect(page.getByRole("heading", { name: "好奇心，准备出发！" })).toBeVisible();
  await page.locator('#main a[href="#reports"]').first().click();
  await expect(page.getByRole("heading", { name: "探索偏好体验" })).toBeVisible();
  await expect(page.getByText("题目来自后台已发布的体验题库，答案按儿童档案保存。", { exact: true })).toHaveCount(0);
  await expect(page.getByText("此处为机器人行为观察，与「陪学伙伴」等机器人服务数据来源不同", { exact: false })).toHaveCount(0);
  await expect(page.getByText("最近成功同步：尚无记录", { exact: false })).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator("#logout-shortcut")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.locator("#logout-shortcut").click();
  await expect(page.getByRole("heading", { name: "家长登录" })).toBeVisible();
});
