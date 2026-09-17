/**
 * T-042 产品巡检：家长端各页面正文留档（上一轮脚本等得太短，只拍到「正在连接成长空间…」）。
 * 顺带把失败的请求 URL 记下来（T-040 记过「每轮 1 条未定位的 console 401」，这里要定到具体接口），
 * 并取人设卡正文作为「结果卡不自动切换」的界面证据。
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
const OUT = path.join(root, ".trellis/tasks/T-042");
const SHOTS = path.join(OUT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const record = { steps: [], pages: [], failed: [], errors: [] };
function note(step, extra = {}) {
  record.steps.push({ step, ...extra });
  console.log("STEP", step, JSON.stringify(extra).slice(0, 900));
}
function save() {
  fs.writeFileSync(path.join(OUT, "walk-parent-pages.json"), JSON.stringify(record, null, 2));
}
function uvBin() {
  const c = [path.join(os.homedir(), ".local/bin/uv"), "/opt/homebrew/bin/uv", "/usr/local/bin/uv"];
  return c.find((x) => fs.existsSync(x)) || "uv";
}
function manage(...args) {
  return execFileSync(
    uvBin(),
    ["run", "--no-sync", "--directory", path.join(root, "backend"), "python", "manage.py", ...args],
    { cwd: root },
  ).toString();
}

const phone = () => "139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (l) => `t042p-${l}-${Math.random().toString(16).slice(2, 10)}`;

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => record.errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") record.errors.push(`console: ${m.text()}`);
});
page.on("response", (r) => {
  if (r.status() >= 400) record.failed.push({ status: r.status(), url: r.url(), method: r.request().method() });
});
page.on("requestfailed", (r) => record.failed.push({ status: "failed", url: r.url(), method: r.request().method() }));

async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true, animations: "disabled" });
}
/** 等到 `#main` 真渲染出内容（首帧是「正在连接成长空间…」）。 */
async function waitMain() {
  await page
    .waitForFunction(
      () => {
        const m = document.querySelector("#main");
        return m && m.innerText.trim().length > 120 && !m.innerText.includes("正在连接成长空间");
      },
      { timeout: 20000 },
    )
    .catch(() => {});
  await page.waitForTimeout(600);
}
async function mainText() {
  return (await page.locator("#main").innerText().catch(() => "")).replace(/\n{3,}/g, "\n\n").slice(0, 6000);
}
async function sidebarText() {
  return (await page.locator(".sidebar, aside").first().innerText().catch(() => ""))
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 800);
}

async function login() {
  const number = phone();
  await page.goto(`${BASE}/`);
  await page.waitForTimeout(700);
  await page.getByLabel("手机号", { exact: true }).fill(number);
  let ok = false;
  for (let i = 0; i < 20 && !ok; i++) {
    await page.getByRole("button", { name: "获取验证码", exact: true }).click();
    await page.waitForTimeout(1500);
    const notices = await page.locator(".notice").allInnerTexts().catch(() => []);
    ok = !notices.some((n) => n.includes("验证码请求过多"));
    if (!ok) {
      note("sms rate limited", { attempt: i + 1 });
      await page.waitForTimeout(30000);
    }
  }
  if (!ok) throw new Error("短信频控未放行");
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("heading", { name: "建立儿童档案" }).waitFor({ timeout: 20000 });
  return number;
}
async function child(name) {
  await page.getByLabel("姓名或称呼").fill(name);
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/api/v1/children") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  const id = (await (await pending).json()).id;
  await page.getByRole("heading", { name: "好奇心，准备出发！" }).waitFor({ timeout: 20000 });
  return id;
}
async function bindRobot(mine) {
  await page.goto(`${BASE}/?nfc_token=${mine}`);
  const dialog = page.locator("#dialog");
  await dialog.getByRole("heading", { name: "绑定机器人" }).waitFor({ timeout: 15000 });
  await dialog.getByLabel("机器人凭据").fill(mine);
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "确认绑定" }).click();
  await pending;
  await dialog.waitFor({ state: "hidden" });
}
async function grantSync(id) {
  await page.goto(`${BASE}/#settings`);
  await page.reload();
  await waitMain();
  await page.getByRole("button", { name: "核验并关联", exact: true }).click();
  await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
  await page.getByLabel("核验凭据", { exact: true }).fill("TEST-PROOF-" + id);
  const pending = page.waitForResponse((r) => r.url().endsWith("/associations/verify"));
  await page.getByRole("button", { name: "确认核验", exact: true }).click();
  await pending;
  await page.reload();
  await waitMain();
}

const number = await login();
const id = await child("巡检页面儿童");
manage("inject_fixture", "--child-id", id, "--scenario", "sync_success");
await bindRobot(token("bind"));
await grantSync(id);
manage("inject_fixture", "--child-id", id, "--scenario", "assessment_success");
manage("inject_fixture", "--child-id", id, "--scenario", "ca_display_normal_art");
note("准备完成", { phone: number, childId: id });

const ROUTES = [
  ["home", "今日陪伴"],
  ["explore", "天赋探索"],
  ["journey", "成长旅程"],
  ["reports", "测评与报告"],
  ["companion", "我的 DingDong"],
  ["settings", "账户与关联"],
  ["services", "家长支持"],
  ["nonexistent-route-probe", "（不存在的路由，仅记事实）"],
];
for (const [route, label] of ROUTES) {
  await page.goto(`${BASE}/#${route}`);
  await page.reload();
  await waitMain();
  const text = await mainText();
  record.pages.push({ route, label, text });
  await shot(`pages-${route}-desktop`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  record.pages.push({ route, label: label + " (390×844)", overflow });
  await shot(`pages-${route}-mobile`);
  await page.setViewportSize({ width: 1440, height: 900 });
  note(`page ${route}`, { overflow, len: text.length });
}
record.sidebar = await sidebarText();

// 人设卡正文：结果卡出现后仍显示原角色，是「不自动切换」的界面证据。
await page.goto(`${BASE}/#reports`);
await page.reload();
await waitMain();
const persona = await page.locator(".companion-persona").first().innerText().catch(() => "");
note("人设卡正文", { persona: persona.replace(/\n+/g, " | ") });
record.persona = persona;

save();
console.log("FAILED", JSON.stringify(record.failed, null, 2));
console.log("ERRORS", JSON.stringify(record.errors, null, 2));
await browser.close();
