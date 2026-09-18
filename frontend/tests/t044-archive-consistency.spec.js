/**
 * T-044 的真实 Chrome 验收（P-19）：归档旧号之后，同一页不许再有两种状态口径。
 *
 * 真实流程：登录 → 建档 → 绑定机器人 → 同意同步用途并核验关联 → 归档这个号 →
 * 看「账户与关联」与「测评与报告」。不拦截、不伪造任何接口响应。
 *
 * 前置：后端 8017 + PostgreSQL/Redis 在跑（同其它 spec）。
 */
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { root, uvBin } from "./support.js";

const SHOTS = path.join(root, ".trellis", "tasks", "T-044", "shots");

const phone = () =>
  "137" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");

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

/** 走真实 UI 把机器人绑上（关联与展示面都要有一个 `active` 的 CA 账户）。 */
async function bindRobot(page) {
  const mine = `e2e-t044-${Math.random().toString(16).slice(2, 10)}`;
  await page.goto(`/?nfc_token=${mine}`);
  const dialog = page.locator("#dialog");
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

/** 同意同步用途并核验凭据（未同意时展示面只说「尚未同意机器人数据同步用途」）。 */
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
  await page.reload();
  await expect(page.getByText(/已核验 · /).first()).toBeVisible({
    timeout: 20000,
  });
}

test("归档旧号后账户页、成长观察与三个展示面口径一致（P-19）", async ({
  page,
}) => {
  test.setTimeout(300000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  fs.mkdirSync(SHOTS, { recursive: true });

  await login(page);
  const id = await child(page, "T044 归档口径儿童");
  inject(id, "sync_success");
  await bindRobot(page);
  await grantSync(page, id);
  inject(id, "ca_display_reassess");

  // 归档前：关联区块说「已核验 · …」，成长观察不是未关联态，展示面有数据。
  await page.goto("/#settings");
  await page.reload();
  await expect(page.getByText(/已核验 · /).first()).toBeVisible({
    timeout: 20000,
  });
  await page.goto("/#reports");
  await page.reload();
  await expect(page.locator("#window-form")).toBeVisible({ timeout: 20000 });
  const observation = page.locator(".panel", { hasText: "最近成功同步" }).first();
  await expect(observation).not.toContainText("尚未关联机器人数据");
  await expect(page.locator(".companion-persona")).not.toContainText(
    "还没有绑定机器人",
  );

  // 归档这个号（真实两步对话框，归档成功后停在账户页）。
  await page.goto("/#settings");
  await page.reload();
  await expect(page.locator(".account-row")).toHaveCount(1, { timeout: 20000 });
  await page.getByRole("button", { name: "归档这个号", exact: true }).click();
  const dialog = page.locator("#dialog");
  await expect(
    dialog.getByRole("heading", { name: "归档这个账户号" }),
  ).toBeVisible({ timeout: 20000 });
  await expect(dialog).toContainText("归档后它上面的数据不会再同步进来");
  const retired = page.waitForResponse(
    (r) => r.url().endsWith("/retire") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "确认归档这个号" }).click();
  expect((await retired).status()).toBe(200);

  // ① 账户页：关联区块不再是「已核验 · 同步已启用」，回到「核验并关联」；
  //    旧号仍在「上一台机器的账户」里可查，并带报告仍可见的说明。
  await expect(page.getByText(/已核验 · /)).toHaveCount(0, { timeout: 20000 });
  await expect(
    page.getByRole("button", { name: "核验并关联", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "上一台机器的账户" }),
  ).toBeVisible();
  // 只剩归档后的这一行（活跃区回到空态），且仍可查
  await expect(page.locator(".account-row")).toHaveCount(1);
  await expect(page.locator(".account-row").first()).toContainText("已归档");
  await page.screenshot({
    path: path.join(SHOTS, "p19-settings-after-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  // ② 测评与报告：成长观察与三个展示面都说「未关联」，不再一边「还没有绑定机器人」
  //    一边「正在等待首次同步」。
  await page.goto("/#reports");
  await page.reload();
  await expect(page.locator("#window-form")).toBeVisible({ timeout: 20000 });
  const after = page.locator(".panel", { hasText: "最近成功同步" }).first();
  await expect(after).toContainText("尚未关联机器人数据", { timeout: 20000 });
  await expect(page.getByText("正在等待首次同步")).toHaveCount(0);
  await expect(page.locator(".companion-persona")).toContainText(
    "还没有绑定机器人",
  );
  await page.screenshot({
    path: path.join(SHOTS, "p19-reports-after-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  // 窄屏：同一屏不再两种口径，也不横向溢出。
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(after).toContainText("尚未关联机器人数据");
  await expect(page.getByText("正在等待首次同步")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: path.join(SHOTS, "p19-reports-after-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });

  expect(errors).toEqual([]);
});
