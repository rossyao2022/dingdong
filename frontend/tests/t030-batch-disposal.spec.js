/**
 * T-030 合成测试批次清理的浏览器验收（真实 Chrome，不拦截任何接口响应）。
 *
 * 一次处置分两阶段跑同一个文件，用 T030_PHASE 选阶段：
 *   T030_PHASE=before（默认）：运营端仍把该批次显示为活跃态、家长端能看到该儿童
 *   T030_PHASE=after：运营端显示已关闭/已归档/已暂停/已撤回、首页失败任务归零，
 *                     家长端登录被拒（账号已停用），并顺带确认正常家长账号不受影响
 *
 * 前置：后端 127.0.0.1:8017、前端 127.0.0.1:4173 已启动；批次数据在库内。
 * 运行（Playwright 需要 frontend/node_modules，所以本文件运行时放在 frontend/tests/ 下）：
 *   cd frontend && T030_PHASE=before npx playwright test tests/t030-batch-disposal.spec.js
 */
import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { root, shell } from "./support.js";

const BACKEND = process.env.OPS_BACKEND_URL || "http://127.0.0.1:8017";
const PHASE = process.env.T030_PHASE === "after" ? "after" : "before";
const shots = path.join(root, ".trellis", "tasks", "T-030", "shots");

const FAMILY_ID = "c3b331ee-9aa1-4065-963b-f1059a2b6711";
const CHILD_ID = "0a4055e4-ffc8-41f2-a8a1-dcc06c85deca";
const CHILD_NAME = "同步失败验证儿童";
const PARENT_PHONE = "+8613748001381";
const SEED_PARENT_PHONE = "13900000001";

function makeAdmin() {
  const username = `t030-${Date.now().toString(36)}-${crypto.randomUUID().slice(0, 6)}`;
  const password = "pw-" + crypto.randomUUID();
  shell(
    `from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from io import StringIO
call_command("seed_base", stdout=StringIO())
u = get_user_model().objects.create_user(username=${JSON.stringify(username)}, password=${JSON.stringify(password)}, account_kind="staff", is_staff=True, name="T-030 验收管理员")
u.groups.set(Group.objects.filter(name="account_admin"))`,
  );
  return { username, password };
}

async function opsLogin(page) {
  const admin = makeAdmin();
  await page.goto(`${BACKEND}/ops/login/`);
  await page.locator("#id_username").fill(admin.username);
  await page.locator("#id_password").fill(admin.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/ops/$"));
}

async function parentLogin(page, number) {
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill(number);
  const loginButton = page.getByRole("button", { name: "登录", exact: true });
  // 同一手机号 60 秒内只能取一次验证码，撞上限频就等窗口过去再取。
  for (let attempt = 1; ; attempt += 1) {
    await page.getByRole("button", { name: "获取验证码", exact: true }).click();
    try {
      await expect(loginButton).toBeEnabled({ timeout: 8000 });
      break;
    } catch (error) {
      const message = (await page.locator("#login-form .form-error").textContent()) || "";
      if (attempt >= 3 || !message.includes("稍后")) throw error;
      await page.waitForTimeout(62000);
    }
  }
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await loginButton.click();
}

test.describe(`T-030 批次清理（${PHASE}）`, () => {
  // 取验证码撞限频时要等 60 秒窗口，默认 60 秒超时不够用。
  test.describe.configure({ timeout: 240000 });

  test(`运营端：批次活跃状态（${PHASE}）`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    mkdirSync(shots, { recursive: true });

    await opsLogin(page);
    await page.screenshot({
      path: path.join(shots, `${PHASE}-ops-dashboard.png`),
      fullPage: true,
    });
    if (PHASE === "before") {
      // 首页「失败任务」里能看到这批注入任务（UPSTREAM_TIMEOUT）
      await expect(page.getByText("上游处理超时").first()).toBeVisible();
    } else {
      await expect(page.getByText("没有失败的生成任务。")).toBeVisible();
    }

    await page.goto(`${BACKEND}/ops/families/${FAMILY_ID}/`);
    const familyStatus = page.locator("dt:has-text('家庭状态') + dd");
    await expect(familyStatus).toBeVisible();
    const childRow = page.locator("tr", { hasText: CHILD_NAME });
    await expect(childRow).toHaveCount(1);
    await page.screenshot({
      path: path.join(shots, `${PHASE}-ops-family-detail.png`),
      fullPage: true,
    });
    await expect(familyStatus).toHaveText(PHASE === "before" ? "正常" : "已关闭");
    await expect(childRow.locator("td").nth(3)).toHaveText(PHASE === "before" ? "正常" : "已归档");

    await page.goto(`${BACKEND}/ops/children/${CHILD_ID}/`);
    const childStatus = page.locator("dt:has-text('档案状态') + dd");
    await expect(childStatus).toBeVisible();
    await page.screenshot({
      path: path.join(shots, `${PHASE}-ops-child-detail.png`),
      fullPage: true,
    });
    await expect(childStatus).toHaveText(PHASE === "before" ? "正常" : "已归档");
    await expect(page.getByText(PHASE === "before" ? "已核验" : "已撤回").first()).toBeVisible();
    await expect(page.getByText(PHASE === "before" ? "同步中" : "已暂停").first()).toBeVisible();

    if (PHASE === "after") {
      // 审计页：清理动作与对象类型都是中文，不出现英文代码。
      // 断言必须限定在表格内：筛选下拉的 <option> 也带同样的中文文案，但不可见。
      await page.goto(`${BACKEND}/ops/audit/?action=synthetic.dispose`);
      const auditTable = page.locator("table.ops-table");
      await expect(auditTable.getByText("清理合成测试数据").first()).toBeVisible();
      await expect(auditTable.getByText("同步游标").first()).toBeVisible();
      await expect(auditTable.getByText("家庭成员").first()).toBeVisible();
      await expect(page.getByText(/未知（/)).toHaveCount(0);
      await expect(auditTable.getByText("synthetic.dispose")).toHaveCount(0);
      await page.screenshot({
        path: path.join(shots, "after-ops-audit-dispose.png"),
        fullPage: true,
      });
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({
        path: path.join(shots, "after-ops-audit-dispose-mobile.png"),
        fullPage: true,
      });
    }

    expect(errors, "运营端页面不应有脚本异常").toEqual([]);
  });

  test(`家长端：批次可见性（${PHASE}）`, async ({ page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    mkdirSync(shots, { recursive: true });

    await parentLogin(page, PARENT_PHONE);
    if (PHASE === "before") {
      await expect(page.locator("#child-select")).toContainText(CHILD_NAME);
      await page.screenshot({
        path: path.join(shots, "before-parent-child-visible.png"),
        fullPage: true,
      });
    } else {
      await expect(page.locator("#login-form .form-error")).toHaveText("账号已停用");
      await page.screenshot({
        path: path.join(shots, "after-parent-login-revoked.png"),
        fullPage: true,
      });
    }
    expect(errors, "家长端页面不应有脚本异常").toEqual([]);
  });

  test("回归：正常家长账号不受影响", async ({ page }) => {
    test.skip(PHASE !== "after", "只在处置后跑");
    await parentLogin(page, SEED_PARENT_PHONE);
    await expect(page.locator("#main-nav")).toBeVisible();
    await expect(page.locator("#login-form .form-error")).toHaveCount(0);
    await page.screenshot({
      path: path.join(shots, "after-seed-parent-unaffected.png"),
      fullPage: true,
    });
  });
});
