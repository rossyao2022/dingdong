/**
 * T-024 诊断（决定性复现）：家长在「陪学伙伴 → 互动健康度」里点「先不测」。
 *
 * 前置走完整链路（同意同步用途 + 核验通过），否则展示面返回 no_consent、不出复测区块。
 * 记录：真实响应状态与响应体、点击后页面上出现了什么、区块有没有变化。
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
const phone = () => "132" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (l) => `t024f-${l}-${Math.random().toString(16).slice(2, 10)}`;
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

const bad = [];
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("response", async (r) => {
  if (r.status() < 400 || r.url().includes("favicon")) return;
  let body = "";
  try {
    body = (await r.text()).slice(0, 400);
  } catch {}
  bad.push({ status: r.status(), method: r.request().method(), url: r.url().replace(BASE, ""), body });
});

await page.goto(`${BASE}/`);
await page.waitForTimeout(800);
await page.getByLabel("手机号", { exact: true }).fill(phone());
await page.getByRole("button", { name: "获取验证码", exact: true }).click();
await page.waitForTimeout(1200);
await page.getByLabel("验证码", { exact: true }).fill("00000");
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(1800);
await page.getByLabel("姓名或称呼").fill("诊断戊");
const created = page.waitForResponse((r) => r.url().endsWith("/api/v1/children") && r.request().method() === "POST");
await page.getByRole("button", { name: "保存档案", exact: true }).click();
const childId = (await (await created).json()).id;
await page.waitForTimeout(2500);

inject(childId, "sync_success");
const bindTok = token("bind");
await page.goto(`${BASE}/?nfc_token=${bindTok}`);
await page.waitForTimeout(2000);
await page.locator("#dialog").getByLabel("机器人凭据").fill(bindTok);
const bound = page.waitForResponse((r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST");
await page.locator("#dialog").getByRole("button", { name: "确认绑定" }).click();
await bound;
await page.waitForTimeout(1500);

// 核验并关联（同意同步用途 + 凭据）
await page.goto(`${BASE}/#settings`);
await page.reload();
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "核验并关联", exact: true }).click();
await page.waitForTimeout(700);
await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
await page.getByLabel("核验凭据", { exact: true }).fill("TEST-PROOF-" + childId);
const verified = page.waitForResponse((r) => r.url().endsWith("/associations/verify")).catch((e) => ({ __err: String(e) }));
await page.getByRole("button", { name: "确认核验", exact: true }).click();
const vres = await verified;
await page.waitForTimeout(2000);
const verifyStatus = vres && vres.status ? vres.status() : "(没有响应)";

inject(childId, "ca_display_reassess");
await page.goto(`${BASE}/#reports`);
await page.reload();
await page.waitForTimeout(3500);

const cta = page.locator(".companion-health .reassessment");
const ctaBefore = await cta.innerText().catch(() => "");
bad.length = 0;
let postEvent = "(没有发请求)";
let postBody = "";
const decline = cta.getByRole("button", { name: /先不测/ });
if (await decline.count()) {
  const resp = page
    .waitForResponse((r) => r.url().includes("/reassessment/") && r.url().endsWith("/response"), { timeout: 20000 })
    .catch((e) => ({ __err: String(e).split("\n")[0] }));
  await decline.click();
  const got = await resp;
  if (got && got.status) {
    postEvent = got.status();
    try {
      postBody = (await got.text()).slice(0, 400);
    } catch {}
  } else {
    postEvent = got && got.__err ? got.__err : "(未知)";
  }
  await page.waitForTimeout(3000);
} else {
  postEvent = "(页面没有「先不测」按钮)";
}

const main = await page.locator("#main").innerText();
const i = main.indexOf("陪学伙伴");
const out = {
  childId,
  verifyStatus,
  ctaBefore,
  postEvent,
  postBody,
  ctaAfter: await cta.innerText().catch(() => ""),
  toast: (await page.locator("#toast").innerText().catch(() => "")).trim(),
  panel: main.slice(i, i + 1500),
  bad,
};
await page.screenshot({ path: path.join(SHOTS, "diag-reassess-decline.png"), fullPage: true });
fs.writeFileSync(path.join(root, ".trellis/tasks/T-024/diag-reassess.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ...out, panel: undefined, bad: out.bad }, null, 2).slice(0, 3000));
console.log("--- 面板 ---\n" + out.panel.slice(0, 900));
await browser.close();
