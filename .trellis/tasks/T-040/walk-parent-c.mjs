/**
 * T-040 产品巡检：单次登录做完剩余家长端走查。
 *
 * ① 儿童丙一：核验关联（先错凭据看提示，再用 inject_fixture 真实凭据）→ 六个展示面场景截图
 *    → 各页面（#home/#explore/#journey/#services/#settings/#support）→ 390×844；
 * ② 同家庭第二个儿童丙二：绑定第二台机器人 + 核验 → 对同一 event_id（reassess_mock_001）回写一次
 *    （T-037 端到端复核：不同 CA 账户对同一 event_id 各自成功）。
 *
 * 短信频控（本地按 IP 1 小时 50 次）会让「获取验证码」返回 429，这里带重试等待。
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
  console.log("STEP", step, JSON.stringify(extra).slice(0, 800));
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

const phone = () => "136" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
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

// ---------- 1. 登录（带频控重试） ----------
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
    note("sms rate limited, waiting", { attempt: i + 1, notice });
    await page.waitForTimeout(30000);
  }
}
note("sms ok", { smsOk });
await page.getByLabel("验证码", { exact: true }).fill("00000");
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(1600);

// ---------- 2. 儿童丙一 ----------
await page.getByLabel("姓名或称呼").fill("巡检丙一");
const created = page.waitForResponse(
  (r) => r.url().endsWith("/api/v1/children") && r.request().method() === "POST",
);
await page.getByRole("button", { name: "保存档案", exact: true }).click();
const childA = (await (await created).json()).id;
await page.waitForTimeout(1400);
note("bingyi child A", { childA });

const tokA = token("bingyi-a");
await page.goto(`${BASE}/?nfc_token=${tokA}`);
await page.waitForTimeout(1400);
await page.locator("#dialog").getByLabel("机器人凭据").fill(tokA);
const boundA = page.waitForResponse(
  (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
);
await page.locator("#dialog").getByRole("button", { name: "确认绑定" }).click();
note("bingyi bind A", { status: (await boundA).status() });
await page.waitForTimeout(1200);

// 2a. 错凭据核验
await page.goto(`${BASE}/#settings`);
await page.reload();
await page.waitForTimeout(1300);
await page.getByRole("button", { name: "核验并关联", exact: true }).click();
await page.waitForTimeout(600);
await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
await page.getByLabel("核验凭据", { exact: true }).fill("WRONG-PROOF-000");
const badResp = page.waitForResponse((r) => r.url().endsWith("/associations/verify"));
await page.getByRole("button", { name: "确认核验", exact: true }).click();
const br = await badResp;
await page.waitForTimeout(1200);
note("bingyi verify wrong proof", {
  status: br.status(),
  body: (await br.text()).slice(0, 300),
  dialogText: await page.locator("#dialog").innerText().catch(() => ""),
});
await shot("20-bingyi-verify-wrong-proof");

// 2b. 真实凭据核验
const proofOut = manage("inject_fixture", "--child-id", childA, "--scenario", "sync_success");
const proof = (proofOut.match(/Synthetic proof: (\S+)/) || [])[1] || null;
note("bingyi proof", { ok: Boolean(proof) });
if (!(await page.locator("#dialog").isVisible().catch(() => false))) {
  await page.getByRole("button", { name: "核验并关联", exact: true }).click();
  await page.waitForTimeout(600);
}
await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
await page.getByLabel("核验凭据", { exact: true }).fill(proof || "");
const okResp = page.waitForResponse((r) => r.url().endsWith("/associations/verify"));
await page.getByRole("button", { name: "确认核验", exact: true }).click();
const okr = await okResp;
await page.waitForTimeout(1500);
note("bingyi verify real proof", { status: okr.status(), body: (await okr.text()).slice(0, 300) });
await shot("21-bingyi-settings-verified");

// ---------- 3. 展示面场景逐个走查 ----------
for (const [scenario, name] of [
  ["ca_display_normal_art", "22-bingyi-normal-art"],
  ["ca_display_watch", "23-bingyi-watch"],
  ["ca_display_new_user", "24-bingyi-new-user"],
  ["ca_display_switch", "25-bingyi-switch"],
  ["ca_display_normal_science", "26-bingyi-science-30d"],
  ["ca_display_reassess", "27-bingyi-reassess"],
]) {
  const out = manage("inject_fixture", "--child-id", childA, "--scenario", scenario).trim();
  await page.goto(`${BASE}/#reports`);
  await page.reload();
  await page.waitForTimeout(2000);
  await shot(name);
  const t = await mainText();
  note(`bingyi scenario ${scenario}`, {
    injected: out.slice(0, 80),
    hasSourceNote: t.includes("这里是本机同步到的机器人行为观察"),
    countUnitCount: (t.match(/\bcount\b/g) || []).length,
    rawCodes: ["imitation", "open", "reverse", "cognitive", "count", "readable-v2", "insufficient_data"].filter((c) => t.includes(c)),
    text: t,
  });
  const health = await page.locator(".companion-health").first().innerText().catch(() => "");
  note(`bingyi health ${scenario}`, { text: health.replace(/\n{2,}/g, " | ").slice(0, 700) });
  const obs = await page.locator(".panel", { hasText: "尚未关联机器人数据" }).first().innerText().catch(() => "");
  const obsCard = obs || (await page.locator("section.panel").last().innerText().catch(() => ""));
  note(`bingyi growth-observation ${scenario}`, { text: obsCard.replace(/\n{2,}/g, " | ").slice(0, 800) });
}

// ---------- 4. 各页面 ----------
for (const [hash, name] of [
  ["#home", "28-bingyi-home"],
  ["#explore", "29-bingyi-explore"],
  ["#journey", "30-bingyi-journey"],
  ["#services", "31-bingyi-services"],
  ["#support", "32-bingyi-support"],
  ["#settings", "33-bingyi-settings"],
]) {
  await page.goto(`${BASE}/${hash}`);
  await page.reload();
  await page.waitForTimeout(1400);
  await shot(name);
  note(`bingyi route ${hash}`, { text: await mainText() });
}

// ---------- 5. 窄屏 ----------
await page.setViewportSize({ width: 390, height: 844 });
for (const [hash, name] of [
  ["#reports", "34-bingyi-reports-390"],
  ["#home", "35-bingyi-home-390"],
  ["#settings", "36-bingyi-settings-390"],
]) {
  await page.goto(`${BASE}/${hash}`);
  await page.reload();
  await page.waitForTimeout(1400);
  await shot(name);
  note(`bingyi mobile ${hash}`, {
    ...(await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }))),
  });
}
await page.setViewportSize({ width: 1440, height: 900 });

// ---------- 6. 同家庭第二个儿童：同一 event_id 再回写 ----------
await page.goto(`${BASE}/#settings`);
await page.reload();
await page.waitForTimeout(1300);
await page.getByRole("button", { name: "添加儿童档案", exact: true }).click();
await page.waitForTimeout(700);
await page.getByLabel("姓名或称呼").fill("巡检丙二");
const created2 = page.waitForResponse(
  (r) => r.url().endsWith("/api/v1/children") && r.request().method() === "POST",
);
await page.getByRole("button", { name: "保存档案", exact: true }).click();
const childB = (await (await created2).json()).id;
await page.waitForTimeout(1400);
note("bingyi child B", { childB });

const tokB = token("bingyi-b");
await page.goto(`${BASE}/?nfc_token=${tokB}`);
await page.waitForTimeout(1500);
const dlg = page.locator("#dialog");
const selectVisible = await dlg.locator("select[name=child_id]").count();
if (selectVisible) await dlg.locator("select[name=child_id]").selectOption(childB);
await dlg.getByLabel("机器人凭据").fill(tokB);
const boundB = page.waitForResponse(
  (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
);
await dlg.getByRole("button", { name: "确认绑定" }).click();
note("bingyi bind B", { status: (await boundB).status(), selectedChild: childB });
await page.waitForTimeout(1200);

// 核验关联（真实凭据）
await page.goto(`${BASE}/#settings`);
await page.reload();
await page.waitForTimeout(1300);
await page.getByRole("button", { name: "核验并关联", exact: true }).click();
await page.waitForTimeout(600);
await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
const proofB = (
  manage("inject_fixture", "--child-id", childB, "--scenario", "sync_success").match(
    /Synthetic proof: (\S+)/,
  ) || []
)[1];
await page.getByLabel("核验凭据", { exact: true }).fill(proofB || "");
const okRespB = page.waitForResponse((r) => r.url().endsWith("/associations/verify"));
await page.getByRole("button", { name: "确认核验", exact: true }).click();
note("bingyi verify B", { status: (await okRespB).status() });
await page.waitForTimeout(1400);

note("inject B reassess", { out: manage("inject_fixture", "--child-id", childB, "--scenario", "ca_display_reassess").trim() });
await page.goto(`${BASE}/#reports`);
await page.reload();
await page.waitForTimeout(2000);
await shot("37-bingyi-childB-reassess");

const declineResp = page.waitForResponse(
  (r) => r.url().includes("/reassessment/") && r.url().endsWith("/response"),
);
await page.getByRole("button", { name: "先不测", exact: true }).click();
const dr = await declineResp;
note("childB decline response", { status: dr.status(), body: (await dr.text()).slice(0, 400) });
await page.waitForTimeout(1500);
await shot("38-bingyi-childB-after-decline");
note("childB after decline", { text: await mainText() });

fs.writeFileSync(
  path.join(root, ".trellis/tasks/T-040/walk-parent-c.json"),
  JSON.stringify({ log, errors }, null, 2),
);
console.log("ERRORS", JSON.stringify(errors, null, 2));
await browser.close();
