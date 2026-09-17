/**
 * T-042 产品巡检（第四轮）家长端走查。
 *
 * 三件事：
 * 1. 复测全流程（T-041 修好的 P-16 处）：建议 → 「重新测评」→ 「开始复测」→ 同意对话框
 *    → 22 题 → 提交合成样例 → complete 回写 → 结果卡；`switch_recommended` 真/假各一次。
 * 2. 家长端各页面文案留档（找新卡点）。
 * 3. 390×844 横向溢出与 `pageerror` 检查。
 *
 * 数据全部走 `inject_fixture` 注入，不拦截、不伪造任何 API 响应。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = "/Users/yihu/Documents/ChatGPT/叮咚";
const { createRequire } = await import("node:module");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("playwright");

const BASE = process.env.T042_BASE || "http://127.0.0.1:4173";
const OUT = path.join(root, ".trellis/tasks/T-042");
const SHOTS = path.join(OUT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const record = { steps: [], pages: [], errors: [] };
const errors = record.errors;
function note(step, extra = {}) {
  record.steps.push({ step, ...extra });
  console.log("STEP", step, JSON.stringify(extra).slice(0, 900));
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
function shell(code) {
  return execFileSync(
    uvBin(),
    ["run", "--no-sync", "--directory", path.join(root, "backend"), "python", "manage.py", "shell", "-c", code],
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
function scopeEvent(accountId, unique) {
  shell(`from dingdong_ca.testsupport.models import TestFixture
from dingdong_ca.core.services.ca_display import FIXTURE_DATASET, REASSESSMENT_KIND
row = TestFixture.objects.get(dataset=FIXTURE_DATASET, kind=REASSESSMENT_KIND, subject_key="${accountId}", sequence=1)
row.payload["event"]["event_id"] = "${unique}"
row.save(update_fields=["payload"])
print("scoped")`);
  return unique;
}

const phone = () => "138" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (l) => `t042-${l}-${Math.random().toString(16).slice(2, 10)}`;
const eventId = (l) => `reassess-t042-${l}-${Math.random().toString(16).slice(2, 10)}`;

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true, animations: "disabled" });
}
async function mainText() {
  return (await page.locator("#main").innerText().catch(() => "")).replace(/\n{3,}/g, "\n\n").slice(0, 6000);
}
/** 上一个儿童走查完仍登录着，先退出，否则登录页不出现手机号输入框。 */
async function logout() {
  await page.goto(`${BASE}/#settings`);
  await page.reload();
  const btn = page.getByRole("button", { name: "退出登录", exact: true });
  if (await btn.count()) {
    await btn.click();
    await page.waitForTimeout(1000);
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

/** 走真实 UI 跑完 22 题 + 合成样例，返回这次测评的 id。 */
async function completeAssessment(label) {
  await page.getByLabel("我已阅读并同意本次测评用途").check();
  await page.getByRole("button", { name: "同意并开始", exact: true }).click();
  await page.getByText("第 1 / 22 题").waitFor({ timeout: 30000 });
  const id = new URL(page.url()).hash.split("/")[1];
  for (let i = 1; i <= 22; i++) {
    await page.getByText(new RegExp(`第 ${i} / 22 题`)).waitFor({ timeout: 20000 });
    await page.getByRole("radio").first().check();
    await page
      .getByRole("button", { name: i === 22 ? "保存并完成" : "保存并下一题", exact: true })
      .click();
  }
  await page.getByText("真实指纹采集尚未开放", { exact: true }).waitFor({ timeout: 20000 });
  await page.getByRole("button", { name: "提交合成样例", exact: true }).click();
  // 本地单线程 worker 有队列延迟（实测算法处理任务排队 ~50 秒才开跑），超时给足。
  await page.getByText("本次测评已处理完成", { exact: true }).waitFor({ timeout: 240000 });
  await page.getByText("本次复测的结果已经回写。", { exact: true }).waitFor({ timeout: 180000 });
  note(`${label}: 回写完成`, { assessmentId: id });
  return id;
}

/** 一个完整的复测闭环；`expectSwitch` 决定结果卡该走哪个分支。 */
async function reassessmentFlow({ name, scenario, label, expectSwitch }) {
  const number = await login();
  const id = await child(name);
  manage("inject_fixture", "--child-id", id, "--scenario", "sync_success");
  await bindRobot(token(label + "-bind"));
  await grantSync(id);
  manage("inject_fixture", "--child-id", id, "--scenario", "assessment_success");
  const accountId = injectDisplay(id, scenario);
  const event = scopeEvent(accountId, eventId(label));

  await openReports();
  const cta = page.locator(".companion-health .reassessment");
  await cta.waitFor({ timeout: 20000 });
  note(`${label}: 建议出现`, { text: (await cta.innerText()).replace(/\n+/g, " | ") });
  await shot(`${label}-01-suggest-desktop`);

  const answered = page.waitForResponse((r) => r.url().endsWith(`/reassessment/${event}/response`));
  await cta.getByRole("button", { name: "重新测评", exact: true }).click();
  const answeredResponse = await answered;
  note(`${label}: 「重新测评」回写`, {
    status: answeredResponse.status(),
    request: answeredResponse.request().postDataJSON(),
  });
  await page.getByText("已确认重新测评", { exact: false }).waitFor({ timeout: 15000 });
  await shot(`${label}-02-accepted`);

  // 轮询重渲染期间点「开始复测」：对话框要活下来（P-16 的原始路径）。
  let overviewCalls = 0;
  page.on("request", (r) => {
    if (r.url().includes("/growth-overview")) overviewCalls++;
  });
  const before = overviewCalls;
  await page.getByRole("button", { name: "开始复测", exact: true }).click();
  const dialog = page.locator("#dialog");
  await dialog.getByRole("heading", { name: "本次测评用途" }).waitFor({ timeout: 20000 });
  await page.waitForTimeout(4000);
  const dialogOpen = await page.evaluate(() => document.querySelector("#dialog").open);
  note(`${label}: 对话框跨过轮询`, { before, after: overviewCalls, dialogOpen });
  await shot(`${label}-03-dialog-desktop`);

  await page.setViewportSize({ width: 390, height: 844 });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  await shot(`${label}-04-dialog-mobile`);
  await page.setViewportSize({ width: 1440, height: 900 });

  await completeAssessment(label);
  await shot(`${label}-05-completed`);

  // 结果卡在「测评与报告」的陪学伙伴面板里。
  await page.locator("#main-nav").getByRole("link", { name: "测评与报告", exact: true }).click();
  await page.getByRole("heading", { name: "陪学伙伴", exact: true }).waitFor({ timeout: 20000 });
  const section = page.locator(".companion-health .reassessment");
  await section.waitFor({ timeout: 20000 });
  const cardText = (await section.innerText()).replace(/\n+/g, " | ");
  const personaText = (await page.locator(".companion-card, .companion").first().innerText().catch(() => ""))
    .replace(/\n+/g, " | ")
    .slice(0, 600);
  note(`${label}: 结果卡`, { cardText, personaText, expectSwitch, overflow });
  await shot(`${label}-06-result-card-desktop`);
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(`${label}-07-result-card-mobile`);
  await page.setViewportSize({ width: 1440, height: 900 });

  const autoSwitch = await page.evaluate(() =>
    Array.from(document.querySelectorAll(".companion-card, .companion")).map((n) => n.innerText).join(" "),
  );
  note(`${label}: 人设卡现状（无自动切换的证据）`, { autoSwitch: autoSwitch.replace(/\n+/g, " | ").slice(0, 400) });
  return { id, cardText, phone: number };
}

const result = {};
try {
  result.trueBranch = await reassessmentFlow({
    name: "巡检真分支儿童",
    scenario: "ca_display_switch",
    label: "switch",
    expectSwitch: true,
  });
  save();
} catch (e) {
  note("真分支失败", { error: String(e).split("\n")[0] });
  save();
  throw e;
}

try {
  result.falseBranch = await reassessmentFlow({
    name: "巡检假分支儿童",
    scenario: "ca_display_reassess",
    label: "keep",
    expectSwitch: false,
  });
  save();
} catch (e) {
  note("假分支失败", { error: String(e).split("\n")[0] });
  save();
  throw e;
}

// 页面走查：沿用真分支那个儿童（已绑机器人、已同意同步、有展示面数据）。
const ROUTES = [
  ["home", "今日陪伴"],
  ["explore", "天赋探索"],
  ["journey", "成长旅程"],
  ["reports", "测评与报告"],
  ["companion", "我的 DingDong"],
  ["settings", "账户与关联"],
  ["services", "家长支持"],
];
for (const [route, label] of ROUTES) {
  await page.goto(`${BASE}/#${route}`);
  await page.reload();
  await page.waitForTimeout(1200);
  const text = await mainText();
  record.pages.push({ route, label, text });
  await shot(`page-${route}-desktop`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  record.pages.push({ route, label: label + " (390×844)", overflow });
  await shot(`page-${route}-mobile`);
  await page.setViewportSize({ width: 1440, height: 900 });
  note(`page ${route}`, { overflow });
}

// 帮助回执与资料编辑（曾经出过问题的两处）。
await page.goto(`${BASE}/#help`);
await page.reload();
await page.waitForTimeout(1000);
record.pages.push({ route: "help", label: "帮助", text: await mainText() });
await shot("page-help-desktop");

save();
console.log("ERRORS", JSON.stringify(errors));
await browser.close();
