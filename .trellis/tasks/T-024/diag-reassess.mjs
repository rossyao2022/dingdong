/**
 * T-024 诊断：复测「先不测」回写失败（500）之后，页面到底显示了什么、显示在哪一块。
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
const phone = () => "133" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (l) => `t024e-${l}-${Math.random().toString(16).slice(2, 10)}`;
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
const bad = [];
page.on("response", async (r) => {
  if (r.status() < 400 || r.url().includes("favicon")) return;
  let body = "";
  try {
    body = (await r.text()).slice(0, 300);
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
await page.getByLabel("姓名或称呼").fill("诊断丁");
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

inject(childId, "ca_display_reassess");
await page.goto(`${BASE}/#reports`);
await page.reload();
await page.waitForTimeout(3500);

let out_resp = null;
const before = await page.locator("#main").innerText();
bad.length = 0;
const cta = page.locator(".companion-health .reassessment");
console.log("CTA text before click:", JSON.stringify(await cta.innerText().catch(() => "(no cta)")));
const decline = cta.getByRole("button", { name: /先不测/ });
if (!(await decline.count())) {
  console.log("没有「先不测」按钮，跳过点击");
  fs.writeFileSync(path.join(root, ".trellis/tasks/T-024/diag-reassess.json"), JSON.stringify({ childId, ctaBefore: await cta.innerText().catch(() => ""), main: await page.locator("#main").innerText(), bad }, null, 2));
  await page.screenshot({ path: path.join(SHOTS, "diag-reassess-nobutton.png"), fullPage: true });
  await browser.close();
  process.exit(0);
}
const resp = page
  .waitForResponse((r) => r.url().includes("/reassessment/") && r.url().endsWith("/response"), { timeout: 20000 })
  .catch((e) => ({ __err: String(e).split("\n")[0] }));
await decline.click();
out_resp = await resp;
await page.waitForTimeout(3000);

const out = {
  childId,
  responseEvent: out_resp && out_resp.__err ? out_resp.__err : (out_resp ? out_resp.status() : null),
  bad,
  toast: (await page.locator("#toast").innerText().catch(() => "")).trim(),
  ctaAfter: await cta.innerText().catch(() => ""),
  // 页面上任何看起来像错误提示的块
  errorish: await page
    .locator("text=/无法识别|失败|错误|出错了|稍后/")
    .allInnerTexts()
    .catch(() => []),
  growthBlock: (() => null)(),
  mainAfter: await page.locator("#main").innerText(),
};
const i = out.mainAfter.indexOf("成长观察");
out.growthBlock = i < 0 ? "" : out.mainAfter.slice(i, i + 400);
delete out.mainAfter;
await page.screenshot({ path: path.join(SHOTS, "diag-reassess-failure.png"), fullPage: true });
fs.writeFileSync(path.join(root, ".trellis/tasks/T-024/diag-reassess.json"), JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2).slice(0, 4000));
console.log("--- 页面上「已选择暂不」相关文本：", before.includes("已选择暂不"));
await browser.close();
