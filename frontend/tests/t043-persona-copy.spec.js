/**
 * T-043 的真实 Chrome 验收：人设卡的学习风格说明不再写我方与 DingDong 的对接状态。
 *
 * 真实流程：登录 → 建档 → 绑定机器人 → 注入 `ca_display_reassess`（人设 `persona_science_01`，
 * 学习风格标签 `cognitive`）→ 打开「测评与报告」看人设卡。不拦截、不伪造任何接口响应。
 *
 * 前置：后端 8017 + PostgreSQL/Redis 在跑（同其它 spec）。
 */
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { root, uvBin } from "./support.js";

const SHOTS = path.join(root, ".trellis", "tasks", "T-043", "shots");

/** P-18 原句里的对接状态话术，家长端不许再出现。 */
const INTERNAL_PHRASES = ["我方", "对方 code 表", "确认后核对", "直译"];

const phone = () =>
  "135" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");

async function login(page, number = phone()) {
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill(number);
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  // 本地登录要等后端签发令牌 + 拉档案，冷启动实测 3 秒以上，5 秒默认窗口不够。
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible({ timeout: 20000 });
}

async function child(page, name) {
  await page.getByLabel("姓名或称呼").fill(name);
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/children") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  const id = (await (await response).json()).id;
  await expect(
    page.getByRole("heading", { name: "好奇心，准备出发！" }),
  ).toBeVisible({ timeout: 20000 });
  return id;
}

function inject(id, scenario) {
  execFileSync(
    uvBin(),
    [
      "run",
      "--no-sync",
      "--directory",
      path.join(root, "backend"),
      "python",
      "manage.py",
      "inject_fixture",
      "--child-id",
      id,
      "--scenario",
      scenario,
    ],
    { cwd: root },
  );
}

/** 走真实 UI 把机器人绑上（展示面要有一个 `active` 的 CA 账户才取得到数据）。 */
async function bindRobot(page) {
  const mine = `e2e-t043-${Math.random().toString(16).slice(2, 10)}`;
  await page.goto(`/?nfc_token=${mine}`);
  const dialog = page.locator("#dialog");
  // 整页重载后应用要重新恢复会话（本地实测 3 秒以上），5 秒默认窗口不够。
  await expect(
    dialog.getByRole("heading", { name: "绑定机器人" }),
  ).toBeVisible({ timeout: 20000 });
  await dialog.getByLabel("机器人凭据").fill(mine);
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "确认绑定" }).click();
  await pending;
}

async function nav(page, name) {
  await page
    .locator("#main-nav")
    .getByRole("link", { name, exact: true })
    .click();
}

/** 走真实 UI 同意同步用途并核验凭据（展示面在未同意前只说「尚未同意机器人数据同步用途」）。 */
async function grantSync(page, id) {
  await nav(page, "账户与关联");
  await page.getByRole("button", { name: "核验并关联", exact: true }).click();
  await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
  await page.getByLabel("核验凭据", { exact: true }).fill("TEST-PROOF-" + id);
  const verified = page.waitForResponse(
    (r) =>
      r.url().endsWith("/associations/verify") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "确认核验", exact: true }).click();
  expect((await verified).ok(), "核验并关联要成功").toBe(true);
  // 核验成功后页面只给「归属核验成功，正在等待同步结果」这类过渡说法，同步状态由后台
  // 推进；重载后关联区块一律以「已核验 · 」开头，同步到哪一步不影响这条断言。
  await page.reload();
  await expect(page.getByText(/已核验 · /).first()).toBeVisible({
    timeout: 20000,
  });
}

test("人设卡学习风格说明是家长话术（P-18）", async ({ page }) => {
  test.setTimeout(240000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  fs.mkdirSync(SHOTS, { recursive: true });

  await login(page);
  const id = await child(page, "T043 人设卡文案儿童");
  inject(id, "sync_success");
  await bindRobot(page);
  await grantSync(page, id);
  inject(id, "ca_display_reassess");

  await page.goto("/#reports");
  await page.reload();
  await expect(page.locator("#window-form")).toBeVisible({ timeout: 20000 });

  const persona = page.locator(".companion-persona");
  await expect(persona).toContainText("学习风格：认知");

  // 原始取值仍在 `title` 里（悬停可看 code 这条不变）。
  await expect(persona.locator('span[title="cognitive"]')).toHaveText("认知");

  // 新说法交代来源（机器人服务）。
  await expect(persona).toContainText("由机器人服务提供");

  const cardText = await persona.innerText();
  const pageText = await page.evaluate(() => document.body.innerText);
  for (const phrase of INTERNAL_PHRASES) {
    expect(cardText, `人设卡不该出现「${phrase}」`).not.toContain(phrase);
    expect(pageText, `「测评与报告」页不该出现「${phrase}」`).not.toContain(
      phrase,
    );
  }

  await persona.screenshot({
    path: path.join(SHOTS, "p18-persona-copy-desktop.png"),
    animations: "disabled",
  });
  await page.screenshot({
    path: path.join(SHOTS, "p18-reports-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  // 窄屏：文案仍在、不横向溢出。
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(persona).toContainText("学习风格：认知");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await persona.screenshot({
    path: path.join(SHOTS, "p18-persona-copy-mobile.png"),
    animations: "disabled",
  });
  await page.screenshot({
    path: path.join(SHOTS, "p18-reports-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });

  expect(errors).toEqual([]);
});
