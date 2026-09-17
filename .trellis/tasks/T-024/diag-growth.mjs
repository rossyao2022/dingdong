/**
 * T-024 诊断：「成长观察」区块什么时候显示「服务返回了无法识别的数据。」。
 *
 * 变量：注入哪个 ca_display 场景。每次记录窗口查询的真实响应（状态码 + 响应体）。
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
const phone = () => "134" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (l) => `t024d-${l}-${Math.random().toString(16).slice(2, 10)}`;
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

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const responses = [];
page.on("response", async (r) => {
  if (!/observations|sync|stage|profile|window|growth|metrics/i.test(r.url())) return;
  let body = "";
  try {
    body = (await r.text()).slice(0, 600);
  } catch {}
  responses.push({ status: r.status(), url: r.url().replace(BASE, ""), body });
});

async function block() {
  const t = await page.locator("#main").innerText().catch(() => "");
  const i = t.indexOf("成长观察");
  return i < 0 ? "(没有成长观察区块)" : t.slice(i, i + 420);
}

await page.goto(`${BASE}/`);
await page.waitForTimeout(800);
await page.getByLabel("手机号", { exact: true }).fill(phone());
await page.getByRole("button", { name: "获取验证码", exact: true }).click();
await page.waitForTimeout(1200);
await page.getByLabel("验证码", { exact: true }).fill("00000");
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(1800);
await page.getByLabel("姓名或称呼").fill("诊断丙");
const created = page.waitForResponse((r) => r.url().endsWith("/api/v1/children") && r.request().method() === "POST");
await page.getByRole("button", { name: "保存档案", exact: true }).click();
const childId = (await (await created).json()).id;
await page.waitForTimeout(2500);

const out = { childId, cases: [] };
async function probe(label) {
  responses.length = 0;
  await page.goto(`${BASE}/#reports`);
  await page.reload();
  await page.waitForTimeout(3500);
  const text = await block();
  out.cases.push({ label, text, responses: [...responses] });
  console.log(`--- ${label}\n${text}\n`);
}

await probe("未绑定机器人");
const bindTok = token("bind");
await page.goto(`${BASE}/?nfc_token=${bindTok}`);
await page.waitForTimeout(2000);
await page.locator("#dialog").getByLabel("机器人凭据").fill(bindTok);
const bound = page.waitForResponse((r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST");
await page.locator("#dialog").getByRole("button", { name: "确认绑定" }).click();
await bound;
await page.waitForTimeout(1500);
await probe("已绑定、未注入展示面");

for (const s of ["ca_display_normal_art", "ca_display_reassess", "ca_display_new_user"]) {
  inject(childId, s);
  await probe(`注入 ${s}`);
}

await page.screenshot({ path: path.join(SHOTS, "diag-growth-last.png"), fullPage: true });
fs.writeFileSync(path.join(root, ".trellis/tasks/T-024/diag-growth.json"), JSON.stringify(out, null, 2));
await browser.close();
