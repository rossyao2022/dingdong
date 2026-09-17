/**
 * T-024 诊断：「正在连接成长空间…」到底卡在哪。
 *
 * 走真实登录 + 建档，然后反复重载 `#home`，每秒抓一次页面文本与仍在飞的请求，
 * 记录每个请求的耗时与状态码。不拦截、不伪造响应。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = "/Users/yihu/Documents/ChatGPT/叮咚";
const { createRequire } = await import("node:module");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:4173";
const OUT = path.join(root, ".trellis/tasks/T-024/diag-loading.json");
const SHOTS = path.join(root, ".trellis/tasks/T-024/shots");
const phone = () => "138" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

const inflight = new Map();
const finished = [];
const bad = [];
page.on("request", (r) => {
  if (r.url().includes("/api/") || r.url().includes(":8017")) {
    inflight.set(r, Date.now());
  }
});
page.on("requestfinished", (r) => {
  const started = inflight.get(r);
  if (started === undefined) return;
  inflight.delete(r);
  finished.push({ url: r.url(), ms: Date.now() - started });
});
page.on("response", (r) => {
  if (r.status() >= 400) {
    bad.push({
      status: r.status(),
      url: r.url(),
      method: r.request().method(),
      at: new Date().toISOString(),
    });
  }
});
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

async function mainText() {
  return (await page.locator("#main").innerText().catch(() => "")).trim().slice(0, 120);
}

await page.goto(`${BASE}/`);
await page.getByLabel("手机号", { exact: true }).fill(phone());
await page.getByRole("button", { name: "获取验证码", exact: true }).click();
await page.waitForTimeout(1000);
await page.getByLabel("验证码", { exact: true }).fill("00000");
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(1500);
await page.getByLabel("姓名或称呼").fill("诊断儿童");
const created = page.waitForResponse(
  (r) => r.url().endsWith("/api/v1/children") && r.request().method() === "POST",
);
await page.getByRole("button", { name: "保存档案", exact: true }).click();
const childId = (await (await created).json()).id;
await page.waitForTimeout(2000);

const rounds = [];
for (let round = 1; round <= 4; round++) {
  finished.length = 0;
  inflight.clear();
  const t0 = Date.now();
  await page.goto(`${BASE}/#home`);
  await page.reload();
  const samples = [];
  for (let s = 0; s < 25; s++) {
    await page.waitForTimeout(1000);
    samples.push({
      t: Date.now() - t0,
      text: await mainText(),
      pending: [...inflight.keys()].map((r) => r.url()),
    });
    if (samples.at(-1).text && !samples.at(-1).text.startsWith("正在连接")) break;
  }
  await page.screenshot({
    path: path.join(SHOTS, `diag-loading-round${round}.png`),
    fullPage: true,
  });
  rounds.push({
    round,
    settledAtMs: samples.at(-1).t,
    settledText: samples.at(-1).text,
    samples,
    requests: finished.map((f) => ({ url: f.url.replace(BASE, ""), ms: f.ms })),
  });
  console.log(`round ${round}: settled at ${samples.at(-1).t}ms -> ${samples.at(-1).text.slice(0, 40)}`);
}

fs.writeFileSync(
  OUT,
  JSON.stringify({ childId, rounds, bad, pageErrors, finishedLast: finished }, null, 2),
);
console.log("BAD", JSON.stringify(bad, null, 2));
console.log("PAGEERRORS", JSON.stringify(pageErrors, null, 2));
await browser.close();
