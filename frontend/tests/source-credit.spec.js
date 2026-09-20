/**
 * 家长端文案清理回归（2026-09-20 拍板）。
 *
 * G-02 时期「家长支持」页有一行视觉与插画来源声明（SOURCE_CREDIT），页脚另有
 * 「记录保存于账户 · 测评与机器人数据为合成样例」。用户反馈页面提示过多影响
 * 体验，拍板：家长端不再出现合成/测试类字样与冗长声明，来源声明的纪律改由
 * `frontend/README.md` 承担（参考提交 sha 仍在 README 里维护）。
 *
 * 本用例锁定清理后的状态：
 * 1. 「家长支持」页不再渲染 [data-source-credit]；
 * 2. 页脚 source-note 为空；
 * 3. 全页面不出现「合成」字样。
 *
 * 前置：后端运行在 http://127.0.0.1:8017（config.settings.local，本地合成库）。
 */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "..", "..", ".trellis", "tasks", "09-20-parent-copy-cleanup", "shots");
mkdirSync(shots, { recursive: true });

const phone = () =>
  "139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");

async function login(page) {
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill(phone());
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
  await page.getByLabel("姓名或称呼").fill("文案清理儿童");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "好奇心，准备出发！" }),
  ).toBeVisible();
}

test("家长支持页与页脚不再出现来源声明和合成字样", async ({ page }) => {
  await login(page);
  await page
    .locator("#main-nav")
    .getByRole("link", { name: "家长支持" })
    .click();
  await expect(page.getByRole("heading", { name: "家长支持" })).toBeVisible();

  await expect(page.locator("[data-source-credit]")).toHaveCount(0);
  await expect(page.locator("#source-note")).toHaveText("");
  await expect(page.locator("body")).not.toContainText("合成");
  await expect(page.locator("body")).not.toContainText("本地测试");

  await page.screenshot({
    path: join(shots, "services-desktop.png"),
    fullPage: true,
  });
});
