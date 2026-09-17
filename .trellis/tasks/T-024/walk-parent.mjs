/**
 * T-024 产品巡检：家长端第一视角走查（真实 Chrome，探索式，不做断言）。
 *
 * 目的：把家长端从登录到各展示面完整走一遍，逐步截图 + 抓可见文本，
 * 供人工复看找新的卡点/困惑/不信任点。不拦截、不伪造任何 API 响应。
 * 单步失败不中断整轮，失败点会截图并写进 walk-parent.jsonl。
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
const JSONL = path.join(root, ".trellis/tasks/T-024/walk-parent.jsonl");
fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(JSONL, "");

const log = [];
function note(step, extra = {}) {
  const row = { step, ...extra };
  log.push(row);
  fs.appendFileSync(JSONL, JSON.stringify(row) + "\n");
  console.log("STEP", step, JSON.stringify(extra).slice(0, 300));
}

function uvBin() {
  const candidates = [
    path.join(os.homedir(), ".local/bin/uv"),
    "/opt/homebrew/bin/uv",
    "/usr/local/bin/uv",
  ];
  return candidates.find((c) => fs.existsSync(c)) || "uv";
}

function inject(id, scenario) {
  const out = execFileSync(
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
  const line = out.split("\n").find((l) => l.startsWith("Display scenario ready:"));
  return line ? line.trim().split(" for ").pop() : null;
}

const phone = () => "137" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (l) => `t024-${l}-${Math.random().toString(16).slice(2, 10)}`;

const errors = [];
let childId = null;

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

async function text() {
  return (await page.locator("#main").innerText().catch(() => ""))
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 3000);
}

/** 单步失败不中断整轮走查：记下来继续走。 */
async function step(label, fn) {
  try {
    await fn();
  } catch (e) {
    note(`FAILED ${label}`, { error: String(e).split("\n")[0].slice(0, 300) });
    await page
      .screenshot({
        path: path.join(SHOTS, `zz-failed-${label.replace(/[^a-z0-9-]/gi, "-")}.png`),
        fullPage: true,
      })
      .catch(() => {});
  }
}

/** hash 路由必须真正重载才会重新取数。 */
async function route(hash, name, wait = 1000) {
  await page.goto(`${BASE}/${hash}`);
  await page.reload();
  await page.waitForTimeout(wait);
  await shot(name);
  note(`route ${hash}`, { name, text: await text() });
}

// ---------- 1. 登录页与登录校验 ----------
await step("login-flow", async () => {
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(700);
  await shot("01-login");
  note("login page", { text: await text() });

  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.waitForTimeout(900);
  await shot("02-login-empty-phone");
  note("login empty phone", { text: await text() });

  await page.getByLabel("手机号", { exact: true }).fill("123");
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.waitForTimeout(900);
  await shot("03-login-bad-phone");
  note("login bad phone", { text: await text() });

  await page.getByLabel("手机号", { exact: true }).fill(phone());
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.waitForTimeout(1300);
  await shot("04-login-code-sent");
  note("login code sent", { text: await text() });

  await page.getByLabel("验证码", { exact: true }).fill("11111");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForTimeout(1300);
  await shot("05-login-bad-code");
  note("login bad code", { text: await text() });

  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForTimeout(1600);
  await shot("06-archive-empty");
  note("archive page", { text: await text() });

  await page.getByLabel("姓名或称呼").fill("巡检小明");
  const created = page.waitForResponse(
    (r) => r.url().endsWith("/api/v1/children") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  childId = (await (await created).json()).id;
  await page.waitForTimeout(1600);
  await shot("07-explore-first");
  note("explore first", { childId, text: await text() });
});

// ---------- 2. 未绑定机器人时的各页面（空态） ----------
await step("empty-routes", async () => {
  await route("#home", "08-home-empty");
  await route("#reports", "09-reports-empty");
  await route("#settings", "10-settings-empty");
  await route("#journey", "11-journey-empty");
  await route("#services", "12-services-empty");
  await route("#environment", "13-environment-empty");

  await page.setViewportSize({ width: 390, height: 844 });
  await route("#reports", "14-reports-empty-mobile", 800);
  await route("#settings", "15-settings-empty-mobile", 800);
  await page.setViewportSize({ width: 1440, height: 900 });
});

// ---------- 3. 绑定机器人（先错后对）+ 同意同步 ----------
await step("bind-and-verify", async () => {
  const bindTok = token("bind");
  await page.goto(`${BASE}/?nfc_token=${bindTok}`);
  await page.waitForTimeout(1400);
  await shot("16-bind-dialog");
  note("bind dialog", {
    text: await page.locator("#dialog").innerText().catch(() => ""),
  });

  await page.locator("#dialog").getByLabel("机器人凭据").fill("wrong-token-000");
  await page.locator("#dialog").getByRole("button", { name: "确认绑定" }).click();
  await page.waitForTimeout(1800);
  await shot("17-bind-wrong-token");
  note("bind wrong token", {
    mainText: await text(),
    dialogText: await page.locator("#dialog").innerText().catch(() => ""),
  });

  const dialog = page.locator("#dialog");
  if (await dialog.isVisible().catch(() => false)) {
    await dialog.getByLabel("机器人凭据").fill(bindTok);
    const bound = page.waitForResponse(
      (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "确认绑定" }).click();
    await bound;
    await page.waitForTimeout(1400);
    await shot("18-after-bind");
    note("after bind", { text: await text() });
  } else {
    note("bind dialog gone after wrong token", { url: page.url() });
  }

  await page.goto(`${BASE}/#settings`);
  await page.reload();
  await page.waitForTimeout(1200);
  await shot("19-settings-bound");
  note("settings bound", { text: await text() });

  const verifyBtn = page.getByRole("button", { name: "核验并关联", exact: true });
  if (await verifyBtn.count()) {
    await verifyBtn.click();
    await page.waitForTimeout(600);
    await shot("20-verify-dialog");
    note("verify dialog", {
      text: await page.locator("#dialog").innerText().catch(() => ""),
    });
    await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
    await page.getByLabel("核验凭据", { exact: true }).fill("TEST-PROOF-" + childId);
    const verified = page.waitForResponse((r) =>
      r.url().endsWith("/associations/verify"),
    );
    await page.getByRole("button", { name: "确认核验", exact: true }).click();
    await verified;
    await page.waitForTimeout(1400);
    await shot("21-settings-after-verify");
    note("settings after verify", { text: await text() });
  }
});

// ---------- 4. 完整测评 ----------
await step("assessment", async () => {
  await route("#assessment", "22-assessment-intro");
  await page.getByLabel("我已阅读并同意本次测评用途").check();
  await page.getByRole("button", { name: "同意并开始", exact: true }).click();
  await page.waitForTimeout(900);
  const assessmentId = new URL(page.url()).hash.split("/")[1];
  await shot("23-assessment-q1");
  note("assessment q1", { assessmentId, text: await text() });

  await page.reload();
  await page.waitForTimeout(1400);
  await shot("24-assessment-after-reload");
  note("assessment after reload", { text: await text() });

  for (let i = 1; i <= 22; i++) {
    await page.getByRole("radio").first().check();
    await page
      .getByRole("button", {
        name: i === 22 ? "保存并完成" : "保存并下一题",
        exact: true,
      })
      .click();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(900);
  await shot("25-assessment-submit");
  note("assessment submit", { text: await text() });

  await page.getByRole("button", { name: "提交合成样例", exact: true }).click();
  await page.waitForTimeout(9000);
  await shot("26-assessment-done");
  note("assessment done", { text: await text() });
});

// ---------- 5. 有测评结果后的报告页与首页 ----------
await step("after-result", async () => {
  await route("#reports", "27-reports-with-result", 1800);
  await route("#home", "28-home-with-result", 1800);
});

// ---------- 6. 展示面：正常态 + 成长观察 ----------
await step("display-normal", async () => {
  note("inject normal_art", { acct: inject(childId, "ca_display_normal_art") });
  await route("#reports", "29-reports-display-normal", 2000);
  await page.setViewportSize({ width: 390, height: 844 });
  await route("#reports", "30-reports-display-normal-mobile", 1400);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto(`${BASE}/#reports`);
  await page.reload();
  await page.waitForTimeout(1400);
  await page.locator("#window-form").scrollIntoViewIfNeeded();
  await shot("31-growth-window");
  await page.locator("#window-form button").first().click();
  await page.waitForTimeout(1800);
  await shot("32-growth-window-invalid");
  note("growth window invalid", { text: await text() });
});

// ---------- 7. 展示面：其余场景 ----------
await step("display-scenarios", async () => {
  for (const [scenario, name] of [
    ["ca_display_watch", "33-display-watch"],
    ["ca_display_new_user", "34-display-new-user"],
    ["ca_display_reassess", "35-display-reassess"],
    ["ca_display_switch", "36-display-switch"],
    ["ca_display_normal_science", "37-display-science-30d"],
  ]) {
    inject(childId, scenario);
    await route("#reports", name, 2000);
  }
});

// ---------- 8. 设置页与环境页收尾 ----------
await step("final-routes", async () => {
  await route("#settings", "38-settings-final", 1400);
  await page.setViewportSize({ width: 390, height: 844 });
  await route("#settings", "39-settings-final-mobile", 1000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await route("#environment", "40-environment-final", 1400);
});

fs.writeFileSync(
  path.join(root, ".trellis/tasks/T-024/walk-parent.json"),
  JSON.stringify({ log, errors }, null, 2),
);
console.log("ERRORS", JSON.stringify(errors, null, 2));
await browser.close();
