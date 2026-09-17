/**
 * T-024 诊断：复测回写 500 之后，「成长观察」区块为什么出现
 * 「服务返回了无法识别的响应。」——抓全部相关请求与响应体，对比点击前后。
 *
 * 前置刻意复刻当时的条件：核验失败（只落了同意授权，没有同步数据）。
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
const phone = () => "131" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (l) => `t024g-${l}-${Math.random().toString(16).slice(2, 10)}`;
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

const trace = [];
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("response", async (r) => {
  if (!r.url().includes("/api/")) return;
  let body = "";
  try {
    body = (await r.text()).slice(0, 220);
  } catch {}
  trace.push({ at: new Date().toISOString().slice(17), status: r.status(), url: r.url().replace(BASE, "").replace("http://127.0.0.1:8017", ""), body });
});

async function growthBlock() {
  const t = await page.locator("#main").innerText();
  const i = t.indexOf("成长观察");
  return i < 0 ? "(无)" : t.slice(i, i + 260);
}

await page.goto(`${BASE}/`);
await page.waitForTimeout(800);
await page.getByLabel("手机号", { exact: true }).fill(phone());
await page.getByRole("button", { name: "获取验证码", exact: true }).click();
await page.waitForTimeout(1200);
await page.getByLabel("验证码", { exact: true }).fill("00000");
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(1800);
await page.getByLabel("姓名或称呼").fill("诊断己");
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

// 核验：故意用错凭据 → 只落同意授权（复刻当时条件）
await page.goto(`${BASE}/#settings`);
await page.reload();
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "核验并关联", exact: true }).click();
await page.waitForTimeout(700);
await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
await page.getByLabel("核验凭据", { exact: true }).fill("WRONG-PROOF");
const vr = page.waitForResponse((r) => r.url().endsWith("/associations/verify")).catch((e) => ({ __err: String(e) }));
await page.getByRole("button", { name: "确认核验", exact: true }).click();
const vres = await vr;
const verifyStatus = vres && vres.status ? vres.status() : String(vres);

inject(childId, "ca_display_reassess");
trace.length = 0;
await page.goto(`${BASE}/#reports`);
await page.reload();
await page.waitForTimeout(3500);
const before = { block: await growthBlock(), trace: [...trace] };

const cta = page.locator(".companion-health .reassessment");
let postStatus = "(没有按钮)";
trace.length = 0;
const decline = cta.getByRole("button", { name: /先不测/ });
if (await decline.count()) {
  const resp = page.waitForResponse((r) => r.url().includes("/reassessment/") && r.url().endsWith("/response"), { timeout: 20000 }).catch((e) => ({ __err: String(e).split("\n")[0] }));
  await decline.click();
  const got = await resp;
  postStatus = got && got.status ? got.status() : String(got);
  await page.waitForTimeout(4000);
}
const after = { block: await growthBlock(), trace: [...trace] };

const out = { childId, verifyStatus, postStatus, before, after };
await page.screenshot({ path: path.join(SHOTS, "diag-reassess-broken-window.png"), fullPage: true });
fs.writeFileSync(path.join(root, ".trellis/tasks/T-024/diag-reassess-window.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 4500));
await browser.close();
