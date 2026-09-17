/**
 * T-040 定点复现：复测建议「重新测评 → 开始复测」点击后无可见反应。
 * 记录点击前后的 DOM/URL/对话框、所有 /api 请求与响应、console 与 pageerror。
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
const SHOTS = path.join(root, ".trellis/tasks/T-040/shots");
fs.mkdirSync(SHOTS, { recursive: true });
const out = { steps: [], requests: [], console: [] };
function note(step, extra = {}) {
  out.steps.push({ step, ...extra });
  console.log("STEP", step, JSON.stringify(extra).slice(0, 600));
}
function uvBin() {
  const candidates = [path.join(os.homedir(), ".local/bin/uv"), "/opt/homebrew/bin/uv"];
  return candidates.find((c) => fs.existsSync(c)) || "uv";
}
function manage(...args) {
  return execFileSync(
    uvBin(),
    ["run", "--no-sync", "--directory", path.join(root, "backend"), "python", "manage.py", ...args],
    { cwd: root },
  ).toString();
}

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => out.console.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") out.console.push("console: " + m.text());
});
page.on("request", (r) => {
  if (r.url().includes("/api/")) out.requests.push({ phase: "req", method: r.method(), url: r.url().replace(BASE, "") });
});
page.on("response", async (r) => {
  if (r.url().includes("/api/")) {
    out.requests.push({ phase: "res", status: r.status(), url: r.url().replace(BASE, "") });
  }
});

await page.goto(`${BASE}/`);
await page.waitForTimeout(700);
await page.getByLabel("手机号", { exact: true }).fill("137" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0"));
await page.getByRole("button", { name: "获取验证码", exact: true }).click();
await page.waitForTimeout(1500);
await page.getByLabel("验证码", { exact: true }).fill("00000");
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(1600);
await page.getByLabel("姓名或称呼").fill("复测承接诊断");
const created = page.waitForResponse((r) => r.url().endsWith("/api/v1/children") && r.request().method() === "POST");
await page.getByRole("button", { name: "保存档案", exact: true }).click();
const childId = (await (await created).json()).id;
await page.waitForTimeout(1400);

const tok = "t040-diag-" + Math.random().toString(16).slice(2, 10);
await page.goto(`${BASE}/?nfc_token=${tok}`);
await page.waitForTimeout(1400);
await page.locator("#dialog").getByLabel("机器人凭据").fill(tok);
const bound = page.waitForResponse((r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST");
await page.locator("#dialog").getByRole("button", { name: "确认绑定" }).click();
note("bind", { status: (await bound).status() });
await page.waitForTimeout(1200);

// 先核验关联拿到「机器人数据同步」授权，否则展示面是 no_consent、不出复测入口。
const proof = (manage("inject_fixture", "--child-id", childId, "--scenario", "sync_success").match(/Synthetic proof: (\S+)/) || [])[1];
await page.goto(`${BASE}/#settings`);
await page.reload();
await page.waitForTimeout(1300);
await page.getByRole("button", { name: "核验并关联", exact: true }).click();
await page.waitForTimeout(600);
await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
await page.getByLabel("核验凭据", { exact: true }).fill(proof || "");
const verified = page.waitForResponse((r) => r.url().endsWith("/associations/verify"));
await page.getByRole("button", { name: "确认核验", exact: true }).click();
note("verify", { status: (await verified).status() });
await page.waitForTimeout(1400);

note("inject", { out: manage("inject_fixture", "--child-id", childId, "--scenario", "ca_display_reassess").trim() });
await page.goto(`${BASE}/#reports`);
await page.reload();
await page.waitForTimeout(2200);
await page.screenshot({ path: path.join(SHOTS, "diag-01-suggest.png"), fullPage: true });

out.requests.length = 0;
await page.getByRole("button", { name: "重新测评", exact: true }).click();
await page.waitForTimeout(2000);
note("after 重新测评", {
  url: page.url(),
  health: (await page.locator(".companion-health").first().innerText().catch(() => "")).replace(/\n{2,}/g, " | "),
  requests: out.requests.slice(),
});
await page.screenshot({ path: path.join(SHOTS, "diag-02-accepted.png"), fullPage: true });

out.requests.length = 0;
const btn = page.getByRole("button", { name: "开始复测", exact: true });
note("开始复测 button count", { count: await btn.count() });
// 点击后每 100ms 采样一次 <dialog>.open，判断「打开过又被关掉」还是「从未打开」
await page.evaluate(() => {
  window.__dlg = [];
  const t0 = performance.now();
  window.__dlgTimer = setInterval(() => {
    const el = document.querySelector("#dialog");
    window.__dlg.push([Math.round(performance.now() - t0), el.open, el.hasAttribute("open"), el.style.display]);
    if (performance.now() - t0 > 6000) clearInterval(window.__dlgTimer);
  }, 100);
});
await btn.click();
await page.waitForTimeout(3000);
note("dialog open timeline", { samples: await page.evaluate(() => window.__dlg.slice(0, 60)) });
await page.waitForTimeout(3500);
note("dialog open timeline (full)", {
  opened: await page.evaluate(() => window.__dlg.filter((s) => s[1]).length),
  closedAfterOpen: await page.evaluate(() => {
    const s = window.__dlg;
    const firstOpen = s.findIndex((x) => x[1]);
    return firstOpen >= 0 && s.slice(firstOpen).some((x) => !x[1]);
  }),
  samples: await page.evaluate(() => window.__dlg),
});
note("after 开始复测", {
  url: page.url(),
  dialogVisible: await page.locator("#dialog").isVisible().catch(() => false),
  dialogText: await page.locator("#dialog").innerText().catch(() => ""),
  health: (await page.locator(".companion-health").first().innerText().catch(() => "")).replace(/\n{2,}/g, " | "),
  formError: await page.locator(".form-error").first().innerText().catch(() => ""),
  requests: out.requests.slice(),
  console: out.console.slice(),
});
await page.screenshot({ path: path.join(SHOTS, "diag-03-after-start.png"), fullPage: true });

// 若出现同意对话框，走完它看是否进入测评
const agree = page.getByLabel("我已阅读并同意本次测评用途");
note("agree checkbox count", { count: await agree.count() });
note("dialog dom state", {
  dialogCount: await page.locator("#dialog").count(),
  dialogVisible: await page.locator("#dialog").isVisible().catch(() => false),
  dialogStyle: await page
    .locator("#dialog")
    .evaluate((el) => ({
      className: el.className,
      hidden: el.hasAttribute("hidden"),
      display: getComputedStyle(el).display,
      visibility: getComputedStyle(el).visibility,
      opacity: getComputedStyle(el).opacity,
      innerHTMLHead: el.innerHTML.slice(0, 160),
    }))
    .catch((e) => String(e).slice(0, 200)),
});
try {
  if (await agree.count()) {
    await agree.check({ timeout: 5000 });
    await page.getByRole("button", { name: "同意并开始", exact: true }).click();
    await page.waitForTimeout(2500);
    note("after agree", { url: page.url(), text: (await page.locator("#main").innerText().catch(() => "")).slice(0, 400) });
    await page.screenshot({ path: path.join(SHOTS, "diag-04-after-agree.png"), fullPage: true });
  }
} catch (e) {
  note("agree step failed", { error: String(e).split("\n")[0].slice(0, 200) });
}

fs.writeFileSync(path.join(root, ".trellis/tasks/T-040/diag-reassessment-start.json"), JSON.stringify(out, null, 2));
console.log("CONSOLE", JSON.stringify(out.console));
await browser.close();
