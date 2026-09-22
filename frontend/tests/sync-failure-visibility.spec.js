import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { root, shell, uvBin } from "./support.js";

/**
 * S-04 阶段画像/数据同步失败在家长端的可见性（T-020）。
 *
 * 用真实命令注入 sync_failure（第一轮同步成功、第二轮 UPSTREAM_TIMEOUT），
 * 由真实 Celery Worker 跑出 checkpoint 错误码，再断言家长端「成长观察」面板
 * 出现可见失败提示。不拦截、不伪造 API 响应。
 */

const phone = () =>
  "137" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");

async function login(page, number = phone()) {
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill(number);
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
  return number;
}

async function child(page, name = "同步失败验证儿童") {
  await page.getByLabel("姓名或称呼").fill(name);
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/children") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  const id = (await (await response).json()).id;
  await expect(
    page.getByRole("heading", { name: "好奇心，准备出发！" }),
  ).toBeVisible();
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

async function nav(page, name) {
  await page
    .locator("#main-nav")
    .getByRole("link", { name, exact: true })
    .click();
}

const failureNotice = "同步未取得最新结果，已有数据不会当作最新数据展示。";
const staleHeading = "显示上次成功同步的观察";

test("数据同步失败在家长端可见（真实 Worker 跑出 checkpoint 错误）", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await login(page);
  const id = await child(page);
  inject(id, "sync_failure");

  // 核验关联，触发第一轮同步（成功），并等到阶段报告生成。
  await nav(page, "账户与关联");
  await page.getByRole("button", { name: "核验并关联", exact: true }).click();
  await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
  await page.getByLabel("核验凭据", { exact: true }).fill("TEST-PROOF-" + id);
  await page.getByRole("button", { name: "确认核验", exact: true }).click();
  await expect(
    page.getByText("已核验 · 同步已启用", { exact: true }),
  ).toBeVisible();
  await nav(page, "测评与报告");
  await expect(
    page.getByRole("button", { name: "查看阶段报告", exact: true }),
  ).toBeVisible({ timeout: 30000 });

  // 立即调度第二轮同步：fixture 里 sequence=2 是 UPSTREAM_TIMEOUT。
  const schedule = shell(
    `from dingdong_ca.core.services.sync import schedule_sync; from dingdong_ca.core.models import ExternalAssociation; a = ExternalAssociation.objects.filter(child_id='${id}', status='verified').first(); print(schedule_sync(a.pk).id if a else 'NO_ASSOCIATION')`,
  );
  const scheduled = schedule.trim().split("\n").pop().trim();
  if (scheduled === "NO_ASSOCIATION") {
    throw new Error("未找到已核验关联，无法调度第二轮同步");
  }

  // 等真实 Worker 把 checkpoint.error_code 写成 UPSTREAM_TIMEOUT（观察面板进入 stale）。
  let overview = null;
  await expect
    .poll(
      async () => {
        const response = page.waitForResponse((r) =>
          r.url().includes("/growth-overview"),
        );
        await page.reload();
        overview = await (await response).json();
        return overview.robot_observation.availability;
      },
      { timeout: 45000, intervals: [2000] },
    )
    .toBe("stale");

  const shots = path.join(root, ".trellis", "tasks", "T-020", "shots");
  fs.mkdirSync(shots, { recursive: true });
  fs.writeFileSync(
    path.join(root, ".trellis", "tasks", "T-020", "growth-overview-after-failure.json"),
    JSON.stringify(overview, null, 2),
  );

  await expect(
    page.getByRole("heading", { name: staleHeading, exact: true }),
  ).toBeVisible();
  await expect(page.getByText(failureNotice, { exact: true })).toBeVisible();
  await page.screenshot({
    path: path.join(shots, "sync-failure-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  // 窄屏同样可见，且不横向溢出。
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: staleHeading, exact: true }),
  ).toBeVisible();
  await expect(page.getByText(failureNotice, { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).toBeTruthy();
  await page.screenshot({
    path: path.join(shots, "sync-failure-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });

  expect(errors).toEqual([]);
});
