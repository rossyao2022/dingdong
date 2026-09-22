import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { root, uvBin } from "./support.js";

/**
 * 复测回写的失败落点（T-037，对应 T-024 的 P-10 后半段与 S-06）。
 *
 * 两件事分开验：
 *
 * 1. **5xx 时失败提示落在复测区块自己这一块**，并给重试入口；「成长观察」区块
 *    不再出现错误横幅。这里的 5xx 是本用例制造的测试故障（照
 *    `deployment-tests/parent-conflict-recovery.spec.js` 的既有例外形状：只拦一条、
 *    只针对一个请求、用完立刻 `unroute`），不代表本地或公网的真实故障。
 * 2. **两个不同家庭的儿童对同一个 `event_id` 都能回写**（P-10 真实路径）：两个
 *    复测 mock 场景共用 fixture 事件 id，修复前第二个儿童必撞唯一约束拿 500。
 *    这一条不拦截任何响应，走真实接口。
 */

const SHOTS = path.join(root, ".trellis", "tasks", "T-037", "shots");
const SUGGEST = "最近一段时间互动偏少，要不要重新测一次？";
const DECLINED = "已选择暂不重新测评";
const FAILED = "这次没写成功，请重试。";
const SERVER_ERROR = "服务暂时不可用，请稍后再试。";

const phone = () =>
  "137" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (label) =>
  `e2e-t037-${label}-${Math.random().toString(16).slice(2, 10)}`;

async function login(page, number = phone()) {
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill(number);
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
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
  ).toBeVisible();
  return id;
}

function inject(id, scenario) {
  return execFileSync(
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
  ).toString();
}

async function bindRobot(page) {
  const mine = token("bind");
  await page.goto(`/?nfc_token=${mine}`);
  const dialog = page.locator("#dialog");
  await expect(
    dialog.getByRole("heading", { name: "绑定机器人" }),
  ).toBeVisible();
  await dialog.getByLabel("机器人凭据").fill(mine);
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "确认绑定" }).click();
  await pending;
}

async function grantSync(page, id) {
  await page.goto("/#settings");
  await page.reload();
  await page.getByRole("button", { name: "核验并关联", exact: true }).click();
  await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
  await page.getByLabel("核验凭据", { exact: true }).fill("TEST-PROOF-" + id);
  const pending = page.waitForResponse((r) =>
    r.url().endsWith("/associations/verify"),
  );
  await page.getByRole("button", { name: "确认核验", exact: true }).click();
  await pending;
  await page.reload();
  await expect(
    page.locator(".key-value", { hasText: "机器人数据同步" }),
  ).toContainText("已同意");
}

/** 同一个 hash 的 goto 不重新取数，每轮都要真正重载一次才看得到新注入的场景。 */
async function openReports(page) {
  await page.goto("/#reports");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "陪学伙伴", exact: true }),
  ).toBeVisible();
}

/** 登录 → 建档 → 绑机器人 → 同意同步 → 注入复测场景（事件 id 用 fixture 原值）。 */
async function readyChild(page, name, label) {
  await login(page);
  const id = await child(page, name);
  inject(id, "sync_success");
  await bindRobot(page);
  await grantSync(page, id);
  inject(id, "ca_display_reassess");
  return id;
}

const block = (page) => page.locator(".companion-health .reassessment");

/** 截图前等 `.page` 的 0.4s 淡入动画走完，否则拍到的是一张半透明的中间帧。 */
async function shot(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: true });
}

test("回写 5xx：失败提示落在复测区块内、成长观察无横幅、重试成功", async ({
  page,
}) => {
  test.setTimeout(600000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  fs.mkdirSync(SHOTS, { recursive: true });

  await readyChild(page, "复测失败儿童", "fail");
  await openReports(page);
  await expect(block(page)).toContainText(SUGGEST);

  // 本用例制造的测试故障：让这一条 POST 回 500 HTML（本地 DEBUG=True 的形状），
  // 只拦这一条、用完立刻解除。
  await page.route("**/reassessment/*/response", (route) =>
    route.fulfill({
      status: 500,
      contentType: "text/html",
      body: "<html><body>IntegrityError at /api/v1/children/…/reassessment/…/response</body></html>",
    }),
  );
  await block(page).getByRole("button", { name: "先不测", exact: true }).click();
  await expect(block(page)).toContainText(FAILED);
  await expect(block(page)).toContainText(SERVER_ERROR);
  await expect(
    block(page).getByRole("button", { name: "重试", exact: true }),
  ).toBeVisible();
  // 失败提示不再落到「成长观察」：整页只有复测区块内这一条错误提示，窗口表单的
  // 错误位（原来那句报错就写在这里）保持空，`#toast` 也不接管。
  await expect(
    page.locator(".notice.error", { hasText: SERVER_ERROR }),
  ).toHaveCount(1);
  await expect(
    page.locator(".companion-health .reassessment .notice.error"),
  ).toHaveCount(1);
  await expect(page.locator("#window-form .form-error")).toHaveText("");
  await expect(page.locator("#window-form")).not.toContainText(SERVER_ERROR);
  await expect(page.locator("#toast")).not.toContainText(SERVER_ERROR);
  await expect(page.locator("body")).not.toContainText("无法识别的响应");
  // 本地没落库，建议与两个按钮都还在。
  await expect(
    block(page).getByRole("button", { name: "重新测评", exact: true }),
  ).toBeVisible();
  await shot(page, "fail-desktop.png");

  // 窄屏：同一状态下的落点与按钮不横向溢出。
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(block(page)).toContainText(FAILED);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBe(0);
  await shot(page, "fail-mobile.png");
  await page.setViewportSize({ width: 1280, height: 720 });

  // 解除故障后重试：真实 POST 成功，回到「已选择暂不重新测评」。
  await page.unroute("**/reassessment/*/response");
  const posted = page.waitForResponse(
    (r) =>
      r.url().includes("/reassessment/") &&
      r.url().endsWith("/response") &&
      r.request().method() === "POST",
  );
  await block(page).getByRole("button", { name: "重试", exact: true }).click();
  expect((await posted).status()).toBe(200);
  await expect(block(page)).toContainText(DECLINED);
  await expect(block(page)).not.toContainText(FAILED);
  await expect(
    block(page).getByRole("button", { name: "重试", exact: true }),
  ).toHaveCount(0);
  await shot(page, "retry-succeeded-desktop.png");

  expect(errors).toEqual([]);
});

test("两个不同家庭的儿童对同一个 event_id 都能回写（P-10 真实路径）", async ({
  browser,
}) => {
  test.setTimeout(900000);
  const errors = [];
  fs.mkdirSync(SHOTS, { recursive: true });

  // 两个儿童在各自家庭里各点一次「先不测」，用的是 fixture 原样的同一个
  // `event_id`（`reassess_mock_001`）。修复前第二个必拿 500。
  for (const [index, name] of ["回写甲", "回写乙"].entries()) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await readyChild(page, name, `same-${index}`);
    await openReports(page);
    await expect(block(page)).toContainText(SUGGEST);
    const posted = page.waitForResponse(
      (r) =>
        r.url().includes("/reassessment/reassess_mock_001/response") &&
        r.request().method() === "POST",
    );
    await block(page).getByRole("button", { name: "先不测", exact: true }).click();
    const response = await posted;
    expect(response.status()).toBe(200);
    await expect(block(page)).toContainText(DECLINED);
    if (index === 1) {
      await shot(page, "same-event-id-second-child.png");
    }
    await context.close();
  }

  expect(errors).toEqual([]);
});
