/**
 * T-040 产品巡检：同步完成后的「成长观察」ready 态 + 完整复测回写路径。
 *
 * 上一轮走查里同步任务在页面加载后才完成，观察区块停在 not_synced，看不到指标；
 * 这里等同步落地后再看（P-13 单位「次」的界面证据），并走完整「重新测评 → 22 题 → 回写 complete」。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = "/Users/yihu/Documents/ChatGPT/叮咚";
const { createRequire } = await import("node:module");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("playwright");

const BASE = process.env.T040_BASE || "http://127.0.0.1:4173";
const SHOTS = path.join(root, `.trellis/tasks/T-040/shots${process.env.T040_SHOTDIR || ""}`);
fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
function note(step, extra = {}) {
  const row = { step, ...extra };
  log.push(row);
  console.log("STEP", step, JSON.stringify(extra).slice(0, 900));
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

const phone = () => "135" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (l) => `t040-${l}-${Math.random().toString(16).slice(2, 10)}`;
const errors = [];

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

async function shot(name) {
  await page.screenshot({
    path: path.join(SHOTS, `${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}
const mainText = async () =>
  (await page.locator("#main").innerText().catch(() => "")).replace(/\n{3,}/g, "\n\n").slice(0, 4000);

// 登录
await page.goto(`${BASE}/`);
await page.waitForTimeout(700);
await page.getByLabel("手机号", { exact: true }).fill(phone());
let smsOk = false;
for (let i = 0; i < 12 && !smsOk; i++) {
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.waitForTimeout(1500);
  const notice = await page.locator(".notice").allInnerTexts().catch(() => []);
  smsOk = !notice.some((n) => n.includes("验证码请求过多"));
  if (!smsOk) {
    note("sms rate limited, waiting", { attempt: i + 1 });
    await page.waitForTimeout(30000);
  }
}
await page.getByLabel("验证码", { exact: true }).fill("00000");
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(1600);

await page.getByLabel("姓名或称呼").fill("巡检丁");
const created = page.waitForResponse(
  (r) => r.url().endsWith("/api/v1/children") && r.request().method() === "POST",
);
await page.getByRole("button", { name: "保存档案", exact: true }).click();
const childId = (await (await created).json()).id;
await page.waitForTimeout(1400);
note("dingyi child", { childId });

const tok = token("dingyi");
await page.goto(`${BASE}/?nfc_token=${tok}`);
await page.waitForTimeout(1400);
await page.locator("#dialog").getByLabel("机器人凭据").fill(tok);
const bound = page.waitForResponse(
  (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
);
await page.locator("#dialog").getByRole("button", { name: "确认绑定" }).click();
note("dingyi bind", { status: (await bound).status() });
await page.waitForTimeout(1200);

const proof = (
  manage("inject_fixture", "--child-id", childId, "--scenario", "sync_success").match(
    /Synthetic proof: (\S+)/,
  ) || []
)[1];
await page.goto(`${BASE}/#settings`);
await page.reload();
await page.waitForTimeout(1300);
await page.getByRole("button", { name: "核验并关联", exact: true }).click();
await page.waitForTimeout(600);
await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
await page.getByLabel("核验凭据", { exact: true }).fill(proof || "");
const okResp = page.waitForResponse((r) => r.url().endsWith("/associations/verify"));
await page.getByRole("button", { name: "确认核验", exact: true }).click();
note("dingyi verify", { status: (await okResp).status() });
await page.waitForTimeout(1400);

// 轮询：同步完成后观察区块应变为 ready
let obsText = "";
for (let i = 0; i < 12; i++) {
  await page.goto(`${BASE}/#reports`);
  await page.reload();
  await page.waitForTimeout(2000);
  const block = await page
    .locator("section.panel", { hasText: "成长观察" })
    .first()
    .innerText()
    .catch(() => "");
  const obs = await page
    .locator(".panel")
    .filter({ hasText: /行为观察|等待首次同步|同步未取得/ })
    .first()
    .innerText()
    .catch(() => "");
  obsText = obs || "";
  if (/合成观察次数/.test(obsText)) break;
  note("observation not ready yet", { attempt: i + 1, block: block.replace(/\n{2,}/g, " | ").slice(0, 300) });
  await page.getByRole("button", { name: "刷新观察状态", exact: true }).click().catch(() => {});
  await page.waitForTimeout(4000);
}
note("dingyi observation block", {
  text: obsText.replace(/\n{2,}/g, " | ").slice(0, 900),
  hasUnitCi: obsText.includes("次"),
  countUnitCount: (obsText.match(/\bcount\b/g) || []).length,
});
await shot("40-dingyi-observation-ready");
note("dingyi reports full text", { text: await mainText() });

// 成长周期报告 30 天 Tab
await page.getByRole("button", { name: "30 天", exact: true }).click().catch(async () => {
  await page.locator(".growth-panel button", { hasText: "30 天" }).first().click().catch(() => {});
});
await page.waitForTimeout(1800);
await shot("41-dingyi-cycle-30d");

// 复测全路径：注入 reassess 场景 → 重新测评 → 22 题 → 回写 complete
note("dingyi inject reassess", { out: manage("inject_fixture", "--child-id", childId, "--scenario", "ca_display_reassess").trim() });
await page.goto(`${BASE}/#reports`);
await page.reload();
await page.waitForTimeout(2000);
await shot("42-dingyi-reassess-suggest");
note("dingyi reassess suggest", {
  text: (await page.locator(".companion-health").first().innerText().catch(() => "")).replace(/\n{2,}/g, " | "),
});

await page.getByRole("button", { name: "重新测评", exact: true }).click();
await page.waitForTimeout(1500);
await shot("43-dingyi-after-accept");
note("dingyi after accept", { url: page.url(), text: await mainText() });

const startBtn = page.getByRole("button", { name: "开始复测", exact: true });
if (await startBtn.count()) {
  await startBtn.click();
  await page.waitForTimeout(1200);
}
note("dingyi assessment entry", { url: page.url(), text: await mainText() });

const agree = page.getByLabel("我已阅读并同意本次测评用途");
if (await agree.count()) {
  await agree.check();
  await page.getByRole("button", { name: "同意并开始", exact: true }).click();
  await page.waitForTimeout(1200);
}
note("dingyi assessment q1", { url: page.url(), text: (await mainText()).slice(0, 600) });

for (let i = 1; i <= 22; i++) {
  await page.getByRole("radio").first().check();
  await page
    .getByRole("button", { name: i === 22 ? "保存并完成" : "保存并下一题", exact: true })
    .click();
  await page.waitForTimeout(280);
}
await page.waitForTimeout(1200);
await shot("44-dingyi-assessment-done");
note("dingyi assessment done", { text: await mainText() });

const submit = page.getByRole("button", { name: "提交合成样例", exact: true });
const completeResp = page.waitForResponse(
  (r) => r.url().includes("/reassessment/") && r.url().endsWith("/complete"),
  { timeout: 45000 },
).catch(() => null);
if (await submit.count()) {
  await submit.click();
  await page.waitForTimeout(9000);
}
const cr = await completeResp;
note("dingyi complete write-back", {
  status: cr ? cr.status() : null,
  body: cr ? (await cr.text()).slice(0, 300) : null,
});
await shot("45-dingyi-completion-card");
note("dingyi completion", { text: await mainText() });

fs.writeFileSync(
  path.join(root, ".trellis/tasks/T-040/walk-parent-d.json"),
  JSON.stringify({ log, errors }, null, 2),
);
console.log("ERRORS", JSON.stringify(errors, null, 2));
await browser.close();
