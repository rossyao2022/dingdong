/**
 * T-024 走查（第二轮）：空态复拍 + 走真实测评入口 + 复测 CTA + 成长观察非法区间。
 *
 * 第一轮把 `#assessment` 当路由直接开，落到「没有找到这个页面」，且各页等待只有 1s
 * （应用启动约 2s），所以空态截图拍到的是「正在连接成长空间…」。这一轮修掉这两点。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = "/Users/yihu/Documents/ChatGPT/叮咚";
const { createRequire } = await import("node:module");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:4173";
const SHOTS = path.join(root, ".trellis/tasks/T-024/shots");
const JSONL = path.join(root, ".trellis/tasks/T-024/walk-parent2.jsonl");
fs.writeFileSync(JSONL, "");
const log = [];
function note(step, extra = {}) {
  const row = { step, ...extra };
  log.push(row);
  fs.appendFileSync(JSONL, JSON.stringify(row) + "\n");
  console.log("STEP", step, JSON.stringify(extra).slice(0, 260));
}

function uvBin() {
  const c = [path.join(os.homedir(), ".local/bin/uv"), "/opt/homebrew/bin/uv", "/usr/local/bin/uv"];
  return c.find((x) => fs.existsSync(x)) || "uv";
}
function inject(id, scenario) {
  const out = execFileSync(
    uvBin(),
    ["run", "--no-sync", "--directory", path.join(root, "backend"), "python", "manage.py", "inject_fixture", "--child-id", id, "--scenario", scenario],
    { cwd: root },
  ).toString();
  const line = out.split("\n").find((l) => l.startsWith("Display scenario ready:"));
  return line ? line.trim().split(" for ").pop() : null;
}
const phone = () => "139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (l) => `t024b-${l}-${Math.random().toString(16).slice(2, 10)}`;

const bad = [];
const pageErrors = [];
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("response", (r) => {
  if (r.status() >= 400 && !r.url().includes("favicon")) {
    bad.push({ status: r.status(), method: r.request().method(), url: r.url().replace(BASE, "").replace("http://127.0.0.1:8017", "") });
  }
});
page.on("pageerror", (e) => pageErrors.push(e.message));

async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true, animations: "disabled" });
}
async function text() {
  return (await page.locator("#main").innerText().catch(() => "")).replace(/\n{3,}/g, "\n\n").slice(0, 3500);
}
async function step(label, fn) {
  try {
    await fn();
  } catch (e) {
    note(`FAILED ${label}`, { error: String(e).split("\n")[0].slice(0, 260) });
    await page.screenshot({ path: path.join(SHOTS, `zz2-failed-${label.replace(/[^a-z0-9-]/gi, "-")}.png`), fullPage: true }).catch(() => {});
  }
}
/** 等到应用真的渲染出内容（不再停在启动占位）或超时。 */
async function settle(ms = 15000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const t = await text();
    if (t && !t.startsWith("正在连接")) return Date.now() - t0;
    await page.waitForTimeout(300);
  }
  return -1;
}
async function route(hash, name, wait = 300) {
  await page.goto(`${BASE}/${hash}`);
  await page.reload();
  const took = await settle();
  await page.waitForTimeout(wait);
  await shot(name);
  note(`route ${hash}`, { name, settleMs: took, text: await text() });
}

let childId = null;

await step("setup", async () => {
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(800);
  await page.getByLabel("手机号", { exact: true }).fill(phone());
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.waitForTimeout(1200);
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForTimeout(1800);
  await page.getByLabel("姓名或称呼").fill("巡检小红");
  const created = page.waitForResponse((r) => r.url().endsWith("/api/v1/children") && r.request().method() === "POST");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  childId = (await (await created).json()).id;
  await page.waitForTimeout(2500);
});

await step("empty-states", async () => {
  await route("#home", "08b-home-empty");
  await route("#reports", "09b-reports-empty");
  await route("#settings", "10b-settings-empty");
  await route("#journey", "11b-journey-empty");
  await route("#services", "12b-services-empty");
  await page.setViewportSize({ width: 390, height: 844 });
  await route("#reports", "14b-reports-empty-mobile");
  await route("#settings", "15b-settings-empty-mobile");
  await route("#home", "16b-home-empty-mobile");
  await page.setViewportSize({ width: 1440, height: 900 });
});

await step("assessment", async () => {
  await route("#reports", "22b-reports-before-assessment");
  await page.getByRole("button", { name: "开始测评", exact: true }).click();
  await page.waitForTimeout(1200);
  await shot("23b-assessment-consent");
  note("assessment consent", { url: page.url(), text: await text() });

  await page.getByLabel("我已阅读并同意本次测评用途").check();
  await page.getByRole("button", { name: "同意并开始", exact: true }).click();
  await page.waitForTimeout(1200);
  await shot("24b-assessment-q1");
  note("assessment q1", { url: page.url(), text: await text() });

  for (let i = 1; i <= 22; i++) {
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: i === 22 ? "保存并完成" : "保存并下一题", exact: true }).click();
    await page.waitForTimeout(350);
    if (i === 10) {
      await shot("25b-assessment-mid");
      note("assessment mid", { text: await text() });
    }
  }
  await page.waitForTimeout(1000);
  await shot("26b-assessment-submit");
  note("assessment submit", { text: await text() });
  await page.getByRole("button", { name: "提交合成样例", exact: true }).click();
  await page.waitForTimeout(12000);
  await shot("27b-assessment-done");
  note("assessment done", { text: await text() });
});

await step("reports-after-result", async () => {
  await route("#reports", "28b-reports-with-result", 1500);
  await route("#home", "29b-home-with-result", 1500);
});

await step("bind-and-verify", async () => {
  const bindTok = token("bind");
  await page.goto(`${BASE}/?nfc_token=${bindTok}`);
  await page.waitForTimeout(2200);
  await page.locator("#dialog").getByLabel("机器人凭据").fill(bindTok);
  const bound = page.waitForResponse((r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST");
  await page.locator("#dialog").getByRole("button", { name: "确认绑定" }).click();
  await bound;
  await page.waitForTimeout(1800);
  await shot("30b-after-bind");
  note("after bind", { text: await text() });

  await route("#settings", "31b-settings-bound");
  await page.getByRole("button", { name: "核验并关联", exact: true }).click();
  await page.waitForTimeout(700);
  await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
  await page.getByLabel("核验凭据", { exact: true }).fill("TEST-PROOF-" + childId);
  const verified = page.waitForResponse((r) => r.url().endsWith("/associations/verify"));
  await page.getByRole("button", { name: "确认核验", exact: true }).click();
  await verified;
  await page.waitForTimeout(1800);
  await shot("32b-settings-verified");
  note("settings verified", { text: await text() });
});

await step("display-and-growth-window", async () => {
  inject(childId, "ca_display_normal_art");
  await route("#reports", "33b-reports-display-normal", 2000);
  await page.setViewportSize({ width: 390, height: 844 });
  await route("#reports", "34b-reports-display-normal-mobile", 1500);
  await page.setViewportSize({ width: 1440, height: 900 });

  // 成长观察：先看默认窗口，再填非法区间（开始 > 结束）
  await route("#reports", "35b-growth-window-default", 1200);
  await page.locator("#window-form").scrollIntoViewIfNeeded();
  const inputs = page.locator("#window-form input");
  await inputs.nth(0).fill("2026-09-20");
  await inputs.nth(1).fill("2026-09-01");
  await page.locator("#window-form").getByRole("button", { name: "查看这个窗口", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.locator("#window-form").scrollIntoViewIfNeeded();
  await shot("36b-growth-window-invalid");
  note("growth window invalid", { text: await text() });

  // 未来区间
  await inputs.nth(0).fill("2027-01-01");
  await inputs.nth(1).fill("2027-01-31");
  await page.locator("#window-form").getByRole("button", { name: "查看这个窗口", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.locator("#window-form").scrollIntoViewIfNeeded();
  await shot("37b-growth-window-future");
  note("growth window future", { text: await text() });
});

await step("reassessment-cta", async () => {
  inject(childId, "ca_display_reassess");
  await route("#reports", "38b-display-reassess", 2200);
  const cta = page.locator(".companion-health .reassessment");
  if (await cta.count()) {
    await cta.scrollIntoViewIfNeeded();
    await shot("39b-reassess-suggest");
    note("reassess suggest", { text: await cta.innerText().catch(() => "") });
    const decline = cta.getByRole("button", { name: /先不测/ });
    if (await decline.count()) {
      const answered = page.waitForResponse((r) => r.url().includes("/reassessment/") && r.url().endsWith("/response"));
      await decline.click();
      await answered;
      await page.waitForTimeout(1500);
      await shot("40b-reassess-declined");
      note("reassess declined", { text: await cta.innerText().catch(() => "") });
    }
  } else {
    note("reassess cta missing", { text: await text() });
  }
});

await step("other-scenarios", async () => {
  for (const [scenario, name] of [
    ["ca_display_watch", "41b-display-watch"],
    ["ca_display_new_user", "42b-display-new-user"],
    ["ca_display_switch", "43b-display-switch"],
    ["ca_display_normal_science", "44b-display-science-30d"],
  ]) {
    inject(childId, scenario);
    await route("#reports", name, 2200);
  }
});

await step("final", async () => {
  await route("#settings", "45b-settings-final", 1200);
  await page.setViewportSize({ width: 390, height: 844 });
  await route("#settings", "46b-settings-final-mobile", 1200);
  await page.setViewportSize({ width: 1440, height: 900 });
  await route("#services", "47b-services-final", 1200);
});

fs.writeFileSync(path.join(root, ".trellis/tasks/T-024/walk-parent2.json"), JSON.stringify({ log, bad, pageErrors }, null, 2));
console.log("BAD", JSON.stringify(bad, null, 2));
console.log("PAGEERRORS", JSON.stringify(pageErrors, null, 2));
await browser.close();
