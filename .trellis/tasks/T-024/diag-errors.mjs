/**
 * T-024 诊断：核对两处失败的真实响应体与界面反馈。
 * ①`POST .../associations/verify` 422；②`POST .../reassessment/<event>/response` 500。
 * 只做真实请求，不拦截、不伪造。
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
const phone = () => "135" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (l) => `t024c-${l}-${Math.random().toString(16).slice(2, 10)}`;

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

const records = [];
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("response", async (r) => {
  if (r.status() < 400 || r.url().includes("favicon")) return;
  let body = "";
  try {
    body = (await r.text()).slice(0, 1200);
  } catch {}
  records.push({ status: r.status(), method: r.request().method(), url: r.url().replace(BASE, "").replace("http://127.0.0.1:8017", ""), post: r.request().postData()?.slice(0, 400), body });
});

const out = {};
async function shot(n) {
  await page.screenshot({ path: path.join(SHOTS, `${n}.png`), fullPage: true, animations: "disabled" });
}
async function mainText() {
  return (await page.locator("#main").innerText().catch(() => "")).slice(0, 1500);
}
async function toast() {
  return (await page.locator("#toast").innerText().catch(() => "")).trim();
}

// 建档 + 绑机器人
await page.goto(`${BASE}/`);
await page.waitForTimeout(800);
await page.getByLabel("手机号", { exact: true }).fill(phone());
await page.getByRole("button", { name: "获取验证码", exact: true }).click();
await page.waitForTimeout(1200);
await page.getByLabel("验证码", { exact: true }).fill("00000");
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(1800);
await page.getByLabel("姓名或称呼").fill("诊断乙");
const created = page.waitForResponse((r) => r.url().endsWith("/api/v1/children") && r.request().method() === "POST");
await page.getByRole("button", { name: "保存档案", exact: true }).click();
const childId = (await (await created).json()).id;
await page.waitForTimeout(2500);

const bindTok = token("bind");
await page.goto(`${BASE}/?nfc_token=${bindTok}`);
await page.waitForTimeout(2000);
await page.locator("#dialog").getByLabel("机器人凭据").fill(bindTok);
const bound = page.waitForResponse((r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST");
await page.locator("#dialog").getByRole("button", { name: "确认绑定" }).click();
await bound;
await page.waitForTimeout(1500);

// ① 核验并关联
records.length = 0;
await page.goto(`${BASE}/#settings`);
await page.reload();
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "核验并关联", exact: true }).click();
await page.waitForTimeout(700);
await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
await page.getByLabel("核验凭据", { exact: true }).fill("TEST-PROOF-" + childId);
const verifyResp = page.waitForResponse((r) => r.url().endsWith("/associations/verify"));
await page.getByRole("button", { name: "确认核验", exact: true }).click();
await verifyResp.catch(() => {});
await page.waitForTimeout(2000);
await shot("diag-verify-result");
out.verify = {
  status: records.map((r) => r.status),
  body: records.map((r) => r.body),
  post: records.map((r) => r.post),
  toast: await toast(),
  dialogStillOpen: await page.locator("#dialog").isVisible().catch(() => false),
  main: await mainText(),
};

// ② 复测「先不测」回写
records.length = 0;
inject(childId, "ca_display_reassess");
await page.goto(`${BASE}/#reports`);
await page.reload();
await page.waitForTimeout(3000);
const cta = page.locator(".companion-health .reassessment");
out.ctaCount = await cta.count();
if (out.ctaCount) {
  await cta.scrollIntoViewIfNeeded();
  await shot("diag-reassess-before");
  const decline = cta.getByRole("button", { name: /先不测/ });
  const resp = page.waitForResponse((r) => r.url().includes("/reassessment/") && r.url().endsWith("/response"));
  await decline.click();
  await resp.catch(() => {});
  await page.waitForTimeout(2500);
  await shot("diag-reassess-after");
  out.reassess = {
    status: records.map((r) => r.status),
    body: records.map((r) => r.body),
    post: records.map((r) => r.post),
    toast: await toast(),
    ctaText: await cta.innerText().catch(() => ""),
  };
}

fs.writeFileSync(path.join(root, ".trellis/tasks/T-024/diag-errors.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 6000));
await browser.close();
