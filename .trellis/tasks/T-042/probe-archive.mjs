/**
 * T-042 定点探针：家长端「归档这个号」（换机器人第一步）之后，四个展示面与账户页各说什么。
 * 上一轮 T-039 记过「换机后旧号人设只读展示」无数据通路，这里看的是家长实际会遇到的界面状态。
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
const record = { steps: [], failed: [], errors: [] };
function note(step, extra = {}) {
  record.steps.push({ step, ...extra });
  console.log("STEP", step, JSON.stringify(extra).slice(0, 1000));
}
function save() {
  fs.writeFileSync(path.join(OUT, "probe-archive.json"), JSON.stringify(record, null, 2));
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
const phone = () => "133" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (l) => `t042a-${l}-${Math.random().toString(16).slice(2, 10)}`;

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
async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true, animations: "disabled" });
}
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
const mainText = async () =>
  (await page.locator("#main").innerText().catch(() => "")).replace(/\n{3,}/g, "\n\n").slice(0, 4000);

// 准备：登录 → 建档 → 绑机器人 → 同意同步 → 注入展示面场景
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
await page.getByLabel("姓名或称呼").fill("换机探针儿童");
const created = page.waitForResponse(
  (r) => r.url().endsWith("/api/v1/children") && r.request().method() === "POST",
);
await page.getByRole("button", { name: "保存档案", exact: true }).click();
const id = (await (await created).json()).id;
await page.getByRole("heading", { name: "好奇心，准备出发！" }).waitFor({ timeout: 20000 });

manage("inject_fixture", "--child-id", id, "--scenario", "sync_success");
const mine = token("bind");
await page.goto(`${BASE}/?nfc_token=${mine}`);
const dialog = page.locator("#dialog");
await dialog.getByRole("heading", { name: "绑定机器人" }).waitFor({ timeout: 15000 });
await dialog.getByLabel("机器人凭据").fill(mine);
const bound = page.waitForResponse(
  (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
);
await dialog.getByRole("button", { name: "确认绑定" }).click();
await bound;
await dialog.waitFor({ state: "hidden" });
await page.goto(`${BASE}/#settings`);
await page.reload();
await waitMain();
await page.getByRole("button", { name: "核验并关联", exact: true }).click();
await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
await page.getByLabel("核验凭据", { exact: true }).fill("TEST-PROOF-" + id);
const verified = page.waitForResponse((r) => r.url().endsWith("/associations/verify"));
await page.getByRole("button", { name: "确认核验", exact: true }).click();
await verified;
manage("inject_fixture", "--child-id", id, "--scenario", "ca_display_normal_art");

await page.goto(`${BASE}/#reports`);
await page.reload();
await waitMain();
note("归档前 #reports", { text: await mainText() });
await shot("probe-archive-01-reports-before");

// 换机第一步：归档当前号
await page.goto(`${BASE}/#settings`);
await page.reload();
await waitMain();
await page.getByRole("button", { name: "归档这个号", exact: true }).click();
const confirm = page.locator("#dialog");
await confirm.getByRole("heading").waitFor({ timeout: 10000 });
note("归档确认对话框", { text: (await confirm.innerText()).replace(/\n+/g, " | ").slice(0, 600) });
await shot("probe-archive-02-dialog");
const archived = page.waitForResponse(
  (r) => r.url().includes("/ca-accounts/") && r.request().method() === "POST",
);
const confirmBtn = confirm.getByRole("button", { name: "确认归档这个号", exact: true });
await confirmBtn.click();
const archivedResponse = await archived.catch(() => null);
note("归档请求", {
  status: archivedResponse && archivedResponse.status(),
  url: archivedResponse && archivedResponse.url(),
  body: archivedResponse && archivedResponse.request().postDataJSON(),
});
await page.waitForTimeout(2500);
await shot("probe-archive-03-settings-after");
note("归档后 #settings", { text: await mainText() });

for (const route of ["reports", "settings"]) {
  await page.goto(`${BASE}/#${route}`);
  await page.reload();
  await waitMain();
  note(`归档后 #${route}`, { text: await mainText() });
  await shot(`probe-archive-04-${route}-after`);
}

save();
console.log("FAILED", JSON.stringify(record.failed, null, 2));
console.log("ERRORS", JSON.stringify(record.errors, null, 2));
await browser.close();
