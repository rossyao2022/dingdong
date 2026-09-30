import { test, expect } from "@playwright/test";

const phone = () =>
  "139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");

test("发码后冷却，刷新与登录退出后仍保留剩余时间", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill(phone());
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await expect(page.locator("#send-code")).toBeDisabled();
  await expect(page.locator("#send-code")).toHaveText(/\d+ 秒后重试/);
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
  await page.goto("/#settings");
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page.locator("#send-code")).toBeDisabled();
  await page.reload();
  await expect(page.locator("#send-code")).toBeDisabled();
  await expect(page.locator("#send-code")).toHaveText(/\d+ 秒后重试/);
  const stored = await page.evaluate(() =>
    JSON.stringify({ ...sessionStorage }),
  );
  expect(stored).not.toContain("139");
});

test("标签进入后刷新，提示重碰且不存凭据；重新碰标签仍能继续", async ({
  page,
}) => {
  const token = "e2e-refresh-" + Math.random().toString(16).slice(2);
  await page.goto(`/?nfc_token=${token}`);
  await expect(page.getByRole("heading", { name: "家长登录" })).toBeVisible();
  expect(page.url()).not.toContain(token);
  expect(
    await page.evaluate(() => JSON.stringify({ ...sessionStorage })),
  ).not.toContain(token);
  await page.reload();
  await expect(page.locator("#main")).toContainText("请再碰一次机器人标签");
  await page.getByLabel("手机号", { exact: true }).fill(phone());
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByLabel("姓名或称呼").fill("刷新恢复合成儿童");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "好奇心，准备出发！" }),
  ).toBeVisible();
  await page.goto("/#settings");
  await expect(page.locator("#main")).toContainText("请再碰一次机器人标签");
  await page.goto(`/?nfc_token=${token}#settings`);
  await expect(page.locator("#dialog")).toBeVisible();
  await expect(page.getByLabel("机器人凭据")).toHaveValue(token);
  await page.getByRole("button", { name: "确认绑定", exact: true }).click();
  await expect(page.locator(".account-row")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "重新连接", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => JSON.stringify({ ...sessionStorage })),
  ).not.toContain(token);
});
