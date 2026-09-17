/**
 * T-040 产品巡检（第三轮）：运营后台走查（真实 Chrome）。
 *
 * 重点：复核 T-038 的 O-06（家庭列表「家长」列）与 O-07（工作首页标签口径），
 * 并逐个一级页 + 详情页找新的卡点。不拦截、不伪造任何响应。
 */
import fs from "node:fs";
import path from "node:path";

const root = "/Users/yihu/Documents/ChatGPT/叮咚";
const { createRequire } = await import("node:module");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:8017";
const SHOTS = path.join(root, ".trellis/tasks/T-040/shots");
fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
const errors = [];
function note(step, extra = {}) {
  log.push({ step, ...extra });
  console.log("STEP", step, JSON.stringify(extra).slice(0, 600));
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
    .slice(0, 4000);
}

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});

await page.goto(`${BASE}/ops/login/`);
await page.waitForTimeout(600);
await page.locator("input[name=username]").fill("admin");
await page.locator("input[name=password]").fill("dingdong-admin");
await page.locator("form button[type=submit]").click();
await page.waitForTimeout(1500);
await shot(page, "ops-01-dashboard");
const dash = await body(page);
note("ops dashboard", { text: dash, hasNewLabel: dash.includes("近 7 天新建档案") });

const pages = [
  ["families/", "ops-02-families"],
  ["children/", "ops-03-children"],
  ["ca-accounts/", "ops-04-ca-accounts"],
  ["questionnaires/", "ops-05-questionnaires"],
  ["activities/", "ops-06-activities"],
  ["reports/", "ops-07-reports"],
  ["jobs/", "ops-08-jobs"],
  ["observations/", "ops-09-observations"],
  ["audit/", "ops-10-audit"],
  ["content/", "ops-11-content"],
  ["support/", "ops-12-support"],
  ["staff/", "ops-13-staff"],
  ["settings/", "ops-14-settings"],
];

const detailLinks = [];
for (const [p, name] of pages) {
  try {
    const resp = await page.goto(`${BASE}/ops/${p}`);
    await page.waitForTimeout(1000);
    await shot(page, name);
    const t = await body(page);
    note(`ops page ${p}`, { status: resp && resp.status(), url: page.url(), text: t });
    const hrefs = await page.locator("a[href*='/ops/']").evaluateAll((as) =>
      as.map((a) => a.getAttribute("href")).filter((h) => /\/(families|children|ca-accounts|questionnaires|activities|reports|jobs|observations|content|staff)\/[^/]+\/$/.test(h || "")),
    );
    if (hrefs.length) detailLinks.push([p, hrefs[0], name.replace(/^ops-\d+-/, "detail-")]);
  } catch (e) {
    note(`FAILED ops page ${p}`, { error: String(e).split("\n")[0].slice(0, 300) });
  }
}

// 家庭列表：O-06 复核（家长列 vs 手机号列）
await page.goto(`${BASE}/ops/families/`);
await page.waitForTimeout(1200);
const famRows = await page
  .locator("table tbody tr")
  .evaluateAll((rows) =>
    rows.slice(0, 8).map((r) => Array.from(r.querySelectorAll("td")).map((td) => td.innerText.trim())),
  );
note("ops families rows", { famRows });
await shot(page, "ops-15-families-rows");

for (const [p, href, name] of detailLinks) {
  try {
    await page.goto(`${BASE}${href}`);
    await page.waitForTimeout(1000);
    await shot(page, `${name}-from-${p.replace(/\//g, "")}`);
    note(`ops detail ${href}`, { text: await body(page) });
  } catch (e) {
    note(`FAILED ops detail ${href}`, { error: String(e).split("\n")[0].slice(0, 300) });
  }
}

// 窄屏
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/ops/`);
await page.waitForTimeout(1200);
await shot(page, "ops-16-dashboard-390");
note("ops mobile dashboard", {
  ...(await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))),
});
await page.goto(`${BASE}/ops/families/`);
await page.waitForTimeout(1200);
await shot(page, "ops-17-families-390");
note("ops mobile families", {
  ...(await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))),
});

fs.writeFileSync(
  path.join(root, ".trellis/tasks/T-040/walk-ops.json"),
  JSON.stringify({ log, errors }, null, 2),
);
console.log("ERRORS", JSON.stringify(errors, null, 2));
await browser.close();
