/**
 * T-024 产品巡检：运营后台第二视角走查（真实 Chrome，探索式，不做断言）。
 *
 * 走法：登录 → 逐个一级页 → 从列表页点进第一条详情 → 截图 + 抓可见文本。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = "/Users/yihu/Documents/ChatGPT/叮咚";
const { createRequire } = await import("node:module");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:8017";
const SHOTS = path.join(root, ".trellis/tasks/T-024/shots");
fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
const errors = [];
function note(step, extra = {}) {
  log.push({ step, ...extra });
  console.log("STEP", step, JSON.stringify(extra).slice(0, 300));
}

async function shot(page, name) {
  await page.screenshot({
    path: path.join(SHOTS, `${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

async function body(page) {
  return (await page.locator("body").innerText().catch(() => ""))
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 3500);
}

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

// 未登录直接访问
await page.goto(`${BASE}/ops/`);
await page.waitForTimeout(800);
await shot(page, "ops-01-redirect");
note("ops redirect", { url: page.url() });

await page.goto(`${BASE}/ops/login/`);
await page.waitForTimeout(600);
await shot(page, "ops-02-login");
note("ops login", { text: await body(page) });

// 错误口令
await page.locator("input[name=username]").fill("admin");
await page.locator("input[name=password]").fill("wrong-password");
await page.locator("form button[type=submit]").click();
await page.waitForTimeout(1000);
await shot(page, "ops-03-login-failed");
note("ops login failed", { text: await body(page) });

await page.locator("input[name=username]").fill("admin");
await page.locator("input[name=password]").fill("dingdong-admin");
await page.locator("form button[type=submit]").click();
await page.waitForTimeout(1500);
await shot(page, "ops-04-dashboard");
note("ops dashboard", { url: page.url(), text: await body(page) });

const pages = [
  ["families/", "ops-05-families"],
  ["questionnaires/", "ops-06-questionnaires"],
  ["activities/", "ops-07-activities"],
  ["reports/", "ops-08-reports"],
  ["jobs/", "ops-09-jobs"],
  ["ca-accounts/", "ops-10-ca-accounts"],
  ["services/", "ops-11-services"],
  ["accounts/", "ops-12-accounts"],
  ["audit/", "ops-13-audit"],
  ["password/", "ops-14-password"],
];

const detailLinks = {};
for (const [p, name] of pages) {
  await page.goto(`${BASE}/ops/${p}`);
  await page.waitForTimeout(900);
  await shot(page, name);
  note(`ops ${p}`, { url: page.url(), text: await body(page) });
  // 记录列表页第一条详情链接，稍后逐条点进去
  const links = await page
    .locator("table a[href], .list a[href], main a[href]")
    .evaluateAll((els) =>
      els
        .map((e) => e.getAttribute("href"))
        .filter((h) => h && h.startsWith("/ops/") && h !== "/ops/"),
    );
  detailLinks[p] = [...new Set(links)].slice(0, 2);
}
note("detail links", detailLinks);

let i = 20;
for (const [p, links] of Object.entries(detailLinks)) {
  for (const href of links) {
    if (/new\/$|password\/|login\/|logout\//.test(href)) continue;
    const name = `ops-${String(i).padStart(2, "0")}-detail-${href.replace(/[^a-z0-9]/gi, "-").slice(0, 40)}`;
    await page.goto(`${BASE}${href}`);
    await page.waitForTimeout(900);
    await shot(page, name);
    note(`ops detail ${href}`, { text: await body(page) });
    i += 1;
  }
}

// 窄屏
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/ops/`);
await page.waitForTimeout(800);
await shot(page, "ops-60-dashboard-mobile");
await page.goto(`${BASE}/ops/families/`);
await page.waitForTimeout(800);
await shot(page, "ops-61-families-mobile");
await page.setViewportSize({ width: 1440, height: 900 });

fs.writeFileSync(
  path.join(root, ".trellis/tasks/T-024/walk-ops.json"),
  JSON.stringify({ log, errors }, null, 2),
);
console.log("ERRORS", JSON.stringify(errors, null, 2));
await browser.close();
