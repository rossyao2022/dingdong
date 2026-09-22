/**
 * T-045 产品巡检（第五轮）家长端走查。
 *
 * 1. 建档 → 绑机器人 → 核验关联 → 22 题测评 → 合成样例 → 初始报告（顺带量报告就绪耗时，供 S-07 判断）。
 * 2. T-043 复核：人设卡学习风格说明行（无「我方 / 对方 code 表 / 确认后核对 / 直译」，`title` 仍留原始取值）。
 * 3. 七个路由 + `#help` 的正文留档、390×844 横向溢出、`pageerror` / console error。
 * 4. T-044 复核：归档旧号探针（账户页 / 测评与报告 / 三个展示面 / 成长观察的口径）。
 *
 * 展示面数据一律 `manage.py inject_fixture` 注入；不拦截、不伪造任何 API 响应。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = "/Users/yihu/Documents/ChatGPT/叮咚";
const { createRequire } = await import("node:module");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("playwright");

const BASE = process.env.T045_BASE || "http://127.0.0.1:4173";
const OUT = path.join(root, ".trellis/tasks/T-045");
const SHOTS = path.join(OUT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const record = { steps: [], pages: [], errors: [], failed: [] };
function note(step, extra = {}) {
  record.steps.push({ step, ...extra });
  console.log("STEP", step, JSON.stringify(extra).slice(0, 1200));
}
function save() {
  fs.writeFileSync(path.join(OUT, "walk-parent.json"), JSON.stringify(record, null, 2));
}

function uvBin() {
  const candidates = [
    path.join(os.homedir(), ".local/bin/uv"),
    "/opt/homebrew/bin/uv",
    "/usr/local/bin/uv",
  ];
  return candidates.find((c) => fs.existsSync(c)) || "uv";
}
function manage(...args) {
  return execFileSync(
    uvBin(),
    ["run", "--no-sync", "--directory", path.join(root, "backend"), "python", "manage.py", ...args],
    { cwd: root },
  ).toString();
}
function injectDisplay(id, scenario) {
  const line = manage("inject_fixture", "--child-id", id, "--scenario", scenario)
    .split("\n")
    .find((l) => l.startsWith("Display scenario ready:"));
  if (!line) throw new Error("没有拿到展示面场景的 ca_account_id：" + scenario);
  return line.trim().split(" for ").pop();
}

const phone = () => "137" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (l) => `t045-${l}-${Math.random().toString(16).slice(2, 10)}`;

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => record.errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") record.errors.push(`console: ${m.text()}`);
});
page.on("response", (r) => {
  if (r.status() >= 400)
    record.failed.push({ status: r.status(), url: r.url(), method: r.request().method() });
});
page.on("requestfailed", (r) =>
  record.failed.push({ status: "failed", url: r.url(), method: r.request().method() }),
);

async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true, animations: "disabled" });
}
async function mainText(limit = 6000) {
  return (await page.locator("#main").innerText().catch(() => ""))
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, limit);
}
async function logout() {
  await page.goto(`${BASE}/#settings`);
  await page.reload();
  await page.waitForTimeout(1200);
  const btn = page.getByRole("button", { name: "退出登录", exact: true });
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(1200);
  }
}
async function login() {
  await logout();
  const number = phone();
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(700);
  await page.getByLabel("手机号", { exact: true }).fill(number);
  let ok = false;
  for (let i = 0; i < 20 && !ok; i++) {
    await page.getByRole("button", { name: "获取验证码", exact: true }).click();
    await page.waitForTimeout(1500);
    const notices = await page.locator(".notice").allInnerTexts().catch(() => []);
    ok = !notices.some((n) => n.includes("验证码请求过多"));
    if (!ok) {
      note("sms rate limited, waiting", { attempt: i + 1, phone: number });
      await page.waitForTimeout(30000);
    }
  }
  if (!ok) throw new Error("短信频控未放行，登录失败：" + number);
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("heading", { name: "建立儿童档案" }).waitFor({ timeout: 20000 });
  return number;
}
async function child(name) {
  await page.getByLabel("姓名或称呼").fill(name);
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/api/v1/children") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  const id = (await (await pending).json()).id;
  await page.getByRole("heading", { name: "好奇心，准备出发！" }).waitFor({ timeout: 20000 });
  return id;
}
async function bindRobot(mine) {
  await page.goto(`${BASE}/?nfc_token=${mine}`);
  const dialog = page.locator("#dialog");
  await dialog.getByRole("heading", { name: "绑定机器人" }).waitFor({ timeout: 15000 });
  await dialog.getByLabel("机器人凭据").fill(mine);
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "确认绑定" }).click();
  await pending;
  await dialog.waitFor({ state: "hidden" });
}
async function grantSync(id) {
  await page.goto(`${BASE}/#settings`);
  await page.reload();
  await page.getByRole("button", { name: "核验并关联", exact: true }).click();
  await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
  await page.getByLabel("核验凭据", { exact: true }).fill("TEST-PROOF-" + id);
  const pending = page.waitForResponse((r) => r.url().endsWith("/associations/verify"));
  await page.getByRole("button", { name: "确认核验", exact: true }).click();
  await pending;
  await page.reload();
  await page.locator(".key-value", { hasText: "机器人数据同步" }).waitFor({ timeout: 15000 });
}
async function openReports() {
  await page.goto(`${BASE}/#reports`);
  await page.reload();
  await page.getByRole("heading", { name: "陪学伙伴", exact: true }).waitFor({ timeout: 20000 });
}

/** 走真实 UI 跑完 22 题 + 合成样例；返回 {id, submitAt, reportReadyAt, reportText}。 */
async function completeAssessment() {
  await page.getByLabel("我已阅读并同意本次测评用途").check();
  await page.getByRole("button", { name: "同意并开始", exact: true }).click();
  await page.getByText("第 1 / 22 题").waitFor({ timeout: 30000 });
  const id = new URL(page.url()).hash.split("/")[1];
  for (let i = 1; i <= 22; i++) {
    await page.getByText(new RegExp(`第 ${i} / 22 题`)).waitFor({ timeout: 20000 });
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: i === 22 ? "保存并完成" : "保存并下一题", exact: true }).click();
  }
  await page.getByText("真实指纹采集尚未开放", { exact: true }).waitFor({ timeout: 20000 });
  const submitAt = Date.now();
  await page.getByRole("button", { name: "提交合成样例", exact: true }).click();
  await page.getByText("本次测评已处理完成", { exact: true }).waitFor({ timeout: 300000 });
  const algorithmDoneAt = Date.now();
  // 「查看初始报告」出现即报告已就绪（本地单线程 worker 有排队延迟，超时给足）。
  let reportReadyAt = null;
  const reportBtn = page.getByRole("button", { name: "查看初始报告", exact: true });
  const deadline = Date.now() + 300000;
  while (Date.now() < deadline) {
    if (await reportBtn.count()) {
      reportReadyAt = Date.now();
      break;
    }
    await page.waitForTimeout(2000);
  }
  note("测评与报告就绪耗时", {
    assessmentId: id,
    submitToAlgorithmDoneMs: algorithmDoneAt - submitAt,
    submitToReportButtonMs: reportReadyAt ? reportReadyAt - submitAt : null,
  });
  await shot("t045-01-report-ready");
  if (reportReadyAt) {
    await reportBtn.click();
    await page.waitForTimeout(1500);
    record.reportText = (await page.locator("#main").innerText().catch(() => "")).slice(0, 3000);
    await shot("t045-02-initial-report");
  }
  return { id, submitAt, reportReadyAt };
}

const result = {};
try {
  const number = await login();
  const id = await child("巡检第五轮儿童");
  manage("inject_fixture", "--child-id", id, "--scenario", "sync_success");
  await bindRobot(token("bind"));
  await grantSync(id);
  manage("inject_fixture", "--child-id", id, "--scenario", "assessment_success");
  const accountId = injectDisplay(id, "ca_display_reassess");
  note("准备完成", { phone: number, childId: id, accountId });
  save();

  await openReports();
  await page.getByLabel("我已阅读并同意本次测评用途").check().catch(() => {});
  const begin = page.getByRole("button", { name: /开始测评|重新测评|开始复测/ }).first();
  if (await begin.count()) {
    await begin.click();
  }
  await page.waitForTimeout(1500);
  if (await page.getByText("第 1 / 22 题").count()) {
    result.assessment = await completeAssessment();
  } else {
    note("测评入口未按预期出现，记事实", { url: page.url() });
    await shot("t045-00-assessment-entry-unexpected");
  }
  save();

  // T-043 复核：人设卡学习风格说明行。
  await openReports();
  const personaHtml = await page
    .locator(".companion-persona")
    .first()
    .innerHTML()
    .catch(() => "");
  const personaText = await page.locator(".companion-persona").first().innerText().catch(() => "");
  record.persona = { text: personaText, html: personaHtml };
  note("T-043 人设卡", {
    text: personaText.replace(/\n+/g, " | ").slice(0, 500),
    hasInternalWording: /我方|对方 code 表|确认后核对|直译/.test(personaText),
    styleTitles: await page
      .locator(".companion-persona [title]")
      .evaluateAll((ns) => ns.map((n) => n.getAttribute("title"))),
  });
  await shot("t045-03-persona-card");

  // 七个路由 + 帮助页正文留档。
  const ROUTES = [
    ["home", "今日陪伴"],
    ["explore", "天赋探索"],
    ["journey", "成长旅程"],
    ["reports", "测评与报告"],
    ["companion", "我的 DingDong"],
    ["settings", "账户与关联"],
    ["services", "家长支持"],
    ["help", "帮助"],
  ];
  for (const [route, label] of ROUTES) {
    await page.goto(`${BASE}/#${route}`);
    await page.reload();
    await page.waitForTimeout(1500);
    const text = await mainText();
    record.pages.push({ route, label, text });
    await shot(`t045-page-${route}-desktop`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    record.pages.push({ route, label: label + " (390×844)", overflow });
    await shot(`t045-page-${route}-mobile`);
    await page.setViewportSize({ width: 1440, height: 900 });
    note(`page ${route}`, { overflow, len: text.length });
  }
  save();

  // T-044 复核：归档旧号探针（换机第一步）。
  await page.goto(`${BASE}/#settings`);
  await page.reload();
  await page.waitForTimeout(1800);
  record.archive = {};
  record.archive.before = await mainText();
  await page.getByRole("button", { name: "归档这个号", exact: true }).click();
  const dialog = page.locator("#dialog");
  await dialog.getByRole("heading", { name: /归档/ }).waitFor({ timeout: 15000 });
  record.archive.dialog = (await dialog.innerText()).replace(/\n+/g, " | ");
  await shot("t045-04-archive-dialog");
  const retired = page.waitForResponse((r) => r.url().includes("/retire"));
  await dialog.getByRole("button", { name: /确认归档|归档/ }).last().click();
  const retiredResponse = await retired;
  record.archive.retire = {
    status: retiredResponse.status(),
    url: retiredResponse.url(),
    method: retiredResponse.request().method(),
  };
  await page.waitForTimeout(2500);
  await page.reload();
  await page.waitForTimeout(2000);
  record.archive.settingsAfter = await mainText();
  await shot("t045-05-settings-after-archive");
  await page.setViewportSize({ width: 390, height: 844 });
  await shot("t045-06-settings-after-archive-mobile");
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`${BASE}/#reports`);
  await page.reload();
  await page.waitForTimeout(2500);
  record.archive.reportsAfter = await mainText();
  await shot("t045-07-reports-after-archive");
  note("归档后口径", {
    settings: (record.archive.settingsAfter || "").replace(/\n+/g, " | ").slice(0, 900),
    reports: (record.archive.reportsAfter || "").replace(/\n+/g, " | ").slice(0, 1200),
  });
  save();

  console.log("FAILED", JSON.stringify(record.failed, null, 2));
  console.log("ERRORS", JSON.stringify(record.errors, null, 2));
} catch (e) {
  note("走查中断", { error: String(e).split("\n")[0] });
  await shot("t045-99-interrupted");
  save();
  throw e;
}
save();
await browser.close();
