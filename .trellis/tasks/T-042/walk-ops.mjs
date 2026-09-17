/**
 * T-042 产品巡检（第四轮）运营端走查。
 *
 * 覆盖 T-041 修过的四处（O-08 姓名列、O-09 家庭角色、O-10 岛屿/情绪、O-11「指纹」），
 * 并把每个真实页面的正文与表格行留档，供找新卡点。不拦截、不伪造任何响应。
 */
import fs from "node:fs";
import path from "node:path";

const root = "/Users/yihu/Documents/ChatGPT/叮咚";
const { createRequire } = await import("node:module");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:8017";
const OUT = path.join(root, ".trellis/tasks/T-042");
const SHOTS = path.join(OUT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const record = { steps: [], pages: [], errors: [] };
const errors = record.errors;
function note(step, extra = {}) {
  record.steps.push({ step, ...extra });
  console.log("STEP", step, JSON.stringify(extra).slice(0, 800));
}
function save() {
  fs.writeFileSync(path.join(OUT, "walk-ops.json"), JSON.stringify(record, null, 2));
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true, animations: "disabled" });
}
async function body(page) {
  return (await page.locator("body").innerText().catch(() => ""))
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 5000);
}

const browser = await chromium.launch({ channel: "chrome" });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
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

const pages = [
  ["", "ops-00-dashboard"],
  ["families/", "ops-01-families"],
  ["questionnaires/", "ops-02-questionnaires"],
  ["activities/", "ops-03-activities"],
  ["reports/", "ops-04-reports"],
  ["jobs/", "ops-05-jobs"],
  ["ca-accounts/", "ops-06-ca-accounts"],
  ["services/", "ops-07-services"],
  ["services/?status=open", "ops-08-services-open"],
  ["accounts/", "ops-09-accounts"],
  ["audit/", "ops-10-audit"],
  ["password/", "ops-11-password"],
];

const detail = [];
for (const [p, name] of pages) {
  const resp = await page.goto(`${BASE}/ops/${p}`);
  await page.waitForTimeout(1100);
  await shot(page, name);
  const text = await body(page);
  record.pages.push({ page: p, name, status: resp && resp.status(), text });
  note(`page ${p || "(dashboard)"}`, { status: resp && resp.status() });
  const hrefs = await page
    .locator("a[href*='/ops/']")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  const picked = hrefs.filter((h) =>
    /\/(services|questionnaires|activities|reports|jobs|ca-accounts|accounts|families|children)\/[0-9a-f-]{36}\//.test(h || ""),
  );
  if (picked.length) detail.push([p, picked[0]]);
}

for (const [p, href] of detail) {
  const resp = await page.goto(`${BASE}${href}`);
  await page.waitForTimeout(1100);
  const name = `ops-detail-${href.replace(/^\/ops\//, "").replace(/\//g, "-")}`;
  await shot(page, name);
  record.pages.push({ page: href, name, status: resp && resp.status(), text: await body(page) });
  note(`detail ${href}`, { status: resp && resp.status() });
}

// 表格行留档（找重复号码、英文码、单位口径这类问题）。
async function rows(url, label) {
  await page.goto(`${BASE}${url}`);
  await page.waitForTimeout(1100);
  const data = await page
    .locator("table tbody tr")
    .evaluateAll((rs) =>
      rs.slice(0, 12).map((r) => Array.from(r.querySelectorAll("td")).map((td) => td.innerText.trim())),
    );
  record.steps.push({ step: `rows ${label}`, rows: data });
  console.log("ROWS", label, JSON.stringify(data).slice(0, 1200));
}
await rows("/ops/services/", "services");
await rows("/ops/ca-accounts/", "ca-accounts");
await rows("/ops/families/", "families");
await rows("/ops/accounts/", "accounts");
await rows("/ops/activities/", "activities");
await rows("/ops/jobs/", "jobs");
await rows("/ops/reports/", "reports");
await rows("/ops/audit/", "audit");

// 390×844：运营端不要求移动端适配，只记横向溢出事实。
await page.goto(`${BASE}/ops/`);
await page.waitForTimeout(800);
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(400);
record.steps.push({
  step: "ops 390x844 overflow",
  overflow: await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth),
});
await shot(page, "ops-dashboard-mobile");

save();
console.log("ERRORS", JSON.stringify(errors, null, 2));
await browser.close();
