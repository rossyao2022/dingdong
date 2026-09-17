/**
 * 产品内的视觉与插画来源声明（G-02）。
 *
 * 改前实测：「沿用参考仓库 d754a5bf…的兴趣岛、伙伴插画和视觉布局」只写在
 * `frontend/README.md` 与 `参考代码/来源说明.md` 里，家长在页面上看不到任何
 * 来源/授权说明；页脚只有「记录保存于账户 · 测评与机器人数据为合成样例」。
 *
 * 改后要求：「家长支持」页给出一行来源与使用声明，指向与 README 同一个参考
 * 提交，并把沿用范围限定在视觉与插画（README：业务逻辑重新接到 CA 后端、
 * 参考仓库未修改），不许把整份实现说成参考项目的产物。
 *
 * 前置：后端运行在 http://127.0.0.1:8017（config.settings.local，本地合成库）。
 */
import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "..", "..", ".trellis", "tasks", "T-017", "shots");
mkdirSync(shots, { recursive: true });

// 声明里的参考提交不能与 README 各说各话：从 README 里读出那个 sha 再比。
const readme = readFileSync(join(here, "..", "README.md"), "utf8");
const reference = readme.match(/\b[0-9a-f]{40}\b/)?.[0];
if (!reference) throw new Error("frontend/README.md 里找不到参考提交 sha");

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
  await page.getByLabel("姓名或称呼").fill("来源声明合成儿童");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "好奇心，准备出发！" }),
  ).toBeVisible();
}

test("家长支持页给出与 README 一致的来源声明", async ({ page }) => {
  await login(page);
  await page
    .locator("#main-nav")
    .getByRole("link", { name: "家长支持" })
    .click();
  await expect(page.getByRole("heading", { name: "家长支持" })).toBeVisible();

  const credit = page.locator("[data-source-credit]");
  await expect(credit).toBeVisible();
  // 指向 README 同一个参考提交，而不是别的版本。
  await expect(credit).toContainText(reference);
  // 沿用范围限定在视觉与插画。
  await expect(credit).toContainText("视觉布局");
  await expect(credit).toContainText("插画");
  await expect(credit).toContainText("业务逻辑");
  // 与 README「参考仓库未修改」不矛盾。
  await expect(credit).toContainText("未修改");

  // 登录后的验证码提示条会盖住页脚，截图前等它自己收起；再等页面入场动画。
  await expect(page.locator("#toast")).not.toHaveClass(/show/);
  await page.waitForTimeout(500);
  await page.screenshot({
    path: join(shots, "services-desktop.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(credit).toBeVisible();
  await page.screenshot({
    path: join(shots, "services-mobile-390x844.png"),
    fullPage: true,
  });
  // 移动端底部导航是 fixed 的：滚到底再截一张，确认声明不会被它压住。
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(300);
  const box = await credit.boundingBox();
  const nav = await page.locator(".mobile-nav").boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(nav.y);
  await page.screenshot({
    path: join(shots, "services-mobile-390x844-bottom.png"),
  });
});
