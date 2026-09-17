/**
 * T-040 源开关复核：CA_DISPLAY_DATA_SOURCE=dingdong（真源未配置）下四个展示面的表现。
 * 跑在独立的前端 4174 / 后端 8018 实例上，不动 4173/8017 那套。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = "/Users/yihu/Documents/ChatGPT/叮咚";
const { createRequire } = await import("node:module");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("playwright");

const BASE = process.env.T040_BASE || "http://127.0.0.1:4174";
const SHOTS = path.join(root, ".trellis/tasks/T-040/shots");
fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
function note(step, extra = {}) {
  const row = { step, ...extra };
  log.push(row);
  console.log("STEP", step, JSON.stringify(extra).slice(0, 900));
}
function uvBin() {
  const c = [path.join(os.homedir(), ".local/bin/uv"), "/opt/homebrew/bin/uv"];
  return c.find((p) => fs.existsSync(p)) || "uv";
}
function manage(...args) {
  return execFileSync(
    uvBin(),
    ["run", "--no-sync", "--directory", path.join(root, "backend"), "python", "manage.py", ...args],
    { cwd: root },
  ).toString();
}

const phone = () => "134" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const errors = [];
const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});
const mainText = async () =>
  (await page.locator("#main").innerText().catch(() => "")).replace(/\n{3,}/g, "\n\n").slice(0, 4000);
async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true, animations: "disabled" });
}

await page.goto(`${BASE}/`);
await page.waitForTimeout(800);
await page.getByLabel("手机号", { exact: true }).fill(phone());
await page.getByRole("button", { name: "获取验证码", exact: true }).click();
await page.waitForTimeout(1500);
await page.getByLabel("验证码", { exact: true }).fill("00000");
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(1600);
await page.getByLabel("姓名或称呼").fill("真源开关儿童");
const created = page.waitForResponse((r) => r.url().endsWith("/api/v1/children") && r.request().method() === "POST");
await page.getByRole("button", { name: "保存档案", exact: true }).click();
const childId = (await (await created).json()).id;
await page.waitForTimeout(1400);
note("child", { childId });

const tok = "t040-live-" + Math.random().toString(16).slice(2, 10);
await page.goto(`${BASE}/?nfc_token=${tok}`);
await page.waitForTimeout(1400);
await page.locator("#dialog").getByLabel("机器人凭据").fill(tok);
const bound = page.waitForResponse((r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST");
await page.locator("#dialog").getByRole("button", { name: "确认绑定" }).click();
note("bind", { status: (await bound).status() });
await page.waitForTimeout(1200);

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

await page.goto(`${BASE}/#reports`);
await page.reload();
await page.waitForTimeout(2500);
await shot("50-dingdong-mode-reports");
const t = await mainText();
note("dingdong-mode reports", {
  hasNotSynced: t.includes("尚未接通") || t.includes("还没接通") || t.includes("机器人数据服务尚未接通"),
  hasNoConsent: t.includes("尚未同意机器人数据同步用途"),
  looksLikeSynthetic: t.includes("合成测试数据") || /匹配度\n\d+/.test(t),
  text: t,
});
const apiProbe = await page.evaluate(async () => {
  const childId = location.hash ? null : null;
  return null;
});
note("probe done", { apiProbe });
note("console errors", { errors });

fs.writeFileSync(path.join(root, ".trellis/tasks/T-040/walk-parent-dingdong.json"), JSON.stringify({ log, errors }, null, 2));
console.log("ERRORS", JSON.stringify(errors));
await browser.close();
