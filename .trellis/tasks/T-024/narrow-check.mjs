/**
 * T-024 窄屏核对：390×844 下家长端各页是否横向溢出（scrollWidth > innerWidth）。
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
const phone = () => "130" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (l) => `t024h-${l}-${Math.random().toString(16).slice(2, 10)}`;
function uvBin() {
  const c = [path.join(os.homedir(), ".local/bin/uv"), "/opt/homebrew/bin/uv", "/usr/local/bin/uv"];
  return c.find((x) => fs.existsSync(x)) || "uv";
}
function inject(id, scenario) {
  execFileSync(
    uvBin(),
    ["run", "--no-sync", "--directory", path.join(root, "backend"), "python", "manage.py", "inject_fixture", "--child-id", id, "--scenario", scenario],
    { cwd: root },
  );
}

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

await page.goto(`${BASE}/`);
await page.waitForTimeout(900);
await page.getByLabel("手机号", { exact: true }).fill(phone());
await page.getByRole("button", { name: "获取验证码", exact: true }).click();
await page.waitForTimeout(1200);
await page.getByLabel("验证码", { exact: true }).fill("00000");
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(1800);
await page.getByLabel("姓名或称呼").fill("窄屏儿童");
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
await page.goto(`${BASE}/#settings`);
await page.reload();
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "核验并关联", exact: true }).click();
await page.waitForTimeout(700);
await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
await page.getByLabel("核验凭据", { exact: true }).fill("TEST-PROOF-" + childId);
const v = page.waitForResponse((r) => r.url().endsWith("/associations/verify")).catch(() => null);
await page.getByRole("button", { name: "确认核验", exact: true }).click();
await v;
await page.waitForTimeout(1500);

const out = { childId, pages: [] };
for (const [scenario, hash] of [
  ["ca_display_normal_art", "#home"],
  ["ca_display_normal_art", "#reports"],
  ["ca_display_normal_art", "#settings"],
  ["ca_display_normal_art", "#journey"],
  ["ca_display_normal_art", "#services"],
  ["ca_display_reassess", "#reports"],
]) {
  inject(childId, scenario);
  await page.goto(`${BASE}/${hash}`);
  await page.reload();
  await page.waitForTimeout(3200);
  const m = await page.evaluate(() => ({
    innerWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    overflowers: [...document.querySelectorAll("body *")]
      .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 6)
      .map((e) => `${e.tagName.toLowerCase()}.${(e.className || "").toString().split(" ")[0]} right=${Math.round(e.getBoundingClientRect().right)}`),
  }));
  out.pages.push({ scenario, hash, ...m });
  console.log(scenario, hash, "scrollWidth", m.scrollWidth, "innerWidth", m.innerWidth, m.overflowers.length ? m.overflowers : "");
}

await page.goto(`${BASE}/#reports`);
await page.reload();
await page.waitForTimeout(3000);
await page.screenshot({ path: path.join(SHOTS, "mobile-reports-reassess-390.png"), fullPage: true });
fs.writeFileSync(path.join(root, ".trellis/tasks/T-024/narrow-check.json"), JSON.stringify(out, null, 2));
await browser.close();
