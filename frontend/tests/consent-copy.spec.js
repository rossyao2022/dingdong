import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 测评授权同意框的信息量（P-03）。
 *
 * 改前实测：弹窗正文只有政策正文一句「[合成测试]仅用于功能验证；不采集或保存真实指纹。」，
 * 家长看不出处理什么、给谁、留多久，勾一个框就开始了。
 * 改后要求：正文补齐四要素（处理目的 / 数据范围 / 数据去向 / 保留与撤回），
 * 仍保留「合成测试」标注，并点明已有「撤回授权」入口。
 *
 * 证据截图写到任务目录（`frontend/docs/` 不进版本库，验收证据要能随任务归档）。
 */
const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "..", "..", ".trellis", "tasks", "T-016", "shots");
mkdirSync(shots, { recursive: true });

const phone = () =>
  "139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");

test("测评同意框补齐四要素并保留合成测试标注与撤回说明", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill(phone());
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
  await page.getByLabel("姓名或称呼").fill("同意框文案测试小芽");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "好奇心，准备出发！" }),
  ).toBeVisible();

  await page.locator("#main-nav").getByRole("link", { name: "测评与报告" }).click();
  await page.getByRole("button", { name: "开始探索体验", exact: true }).click();

  const dialog = page.locator("#dialog");
  await expect(
    dialog.getByRole("heading", { name: "本次测评用途" }),
  ).toBeVisible();

  // 四要素：处理目的 / 数据范围 / 数据去向（含 DingDong 侧）/ 保留与撤回
  for (const label of ["处理目的", "数据范围", "数据去向", "保留与撤回"]) {
    await expect(dialog.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(dialog).toContainText("DingDong 侧");

  // 2026-09-20 拍板：家长端不再显示测试标注。
  await expect(dialog).not.toContainText("合成测试");

  // 点明已有撤回入口，并讲清撤回后果。
  await expect(dialog).toContainText("撤回授权");
  await expect(dialog).toContainText("账户与关联");

  // 同意框本身与开始按钮仍在，勾选后可继续。
  await expect(
    dialog.getByLabel("我已阅读并同意本次测评用途"),
  ).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: join(shots, "t016-consent-desktop.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: join(shots, "t016-consent-mobile.png"),
  });

  // 窄屏：弹窗正文超过一屏时靠弹窗内部滚动，勾选框与开始按钮仍要能到达。
  await dialog
    .getByLabel("我已阅读并同意本次测评用途")
    .scrollIntoViewIfNeeded();
  await expect(
    dialog.getByRole("button", { name: "同意并开始", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: join(shots, "t016-consent-mobile-bottom.png"),
  });

  await dialog.getByLabel("我已阅读并同意本次测评用途").check();
  await page.getByRole("button", { name: "同意并开始", exact: true }).click();
  await expect(page.getByText("第 1 / 4 题", { exact: false })).toBeVisible();
});
