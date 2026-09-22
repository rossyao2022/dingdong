/**
 * T-045 产品巡检（第五轮）运营端走查（v5，适配 v0.3.7）。
 *
 * 覆盖 T-044 修过的三项（O-12 生成任务异常、O-13 其他事项排除自身、O-14 待办最新 5 条），
 * 并把每个真实页面正文与表格行留档，供找新卡点。不拦截、不伪造任何响应。
 */
import fs from "node:fs";
import path from "node:path";

const root = "/Users/yihu/Documents/ChatGPT/叮咚";
const { createRequire } = await import("node:module");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:8017";
const OUT = path.join(root, ".trellis/tasks/T-045");
const SHOTS = path.join(OUT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const record = { steps: [], pages: [], errors: [], failed: [] };
function note(step, extra = {}) {
  record.steps.push({ step, ...extra });
  console.log("STEP", step, JSON.stringify(extra).slice(0, 800));
}
function save() {
  fs.writeFileSync(path.join(OUT, "walk-ops-v5.json"), JSON.stringify(record, null, 2));
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
page.on("pageerror", (e) => record.errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") record.errors.push(`console: ${m.text()}`);
});
page.on("response", (r) => {
  if (r.status() >= 400)
    record.failed.push({ status: r.status(), url: r.url(), method: r.request().method() });
});

await page.goto(`${BASE}/ops/login/`);
await page.waitForTimeout(600);
await page.locator("input[name=username]").fill("t045walk");
await page.locator("input[name=password]").fill("T045-walk-tmp-9f3e");
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
  note(`page ${p || "(dashboard)"}`, { status: resp && resp.status(), len: text.length });
  const hrefs = await page
    .locator("a[href*='/ops/']")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  const picked = hrefs.filter((h) =>
    /\/(services|questionnaires|activities|reports|jobs|ca-accounts|accounts|families|children)\/[0-9a-f-]{36}\//.test(h || ""),
  );
  if (picked.length) detail.push([p, picked[0]]);
}
save();

for (const [p, href] of detail) {
  const resp = await page.goto(`${BASE}${href}`);
  await page.waitForTimeout(1100);
  const name = `ops-detail-${href.replace(/^\/ops\//, "").replace(/\//g, "-")}`;
  await shot(page, name);
  record.pages.push({ page: href, name, status: resp && resp.status(), text: await body(page) });
  note(`detail ${href}`, { status: resp && resp.status() });
}
save();

console.log("FAILED", JSON.stringify(record.failed, null, 2));
console.log("ERRORS", JSON.stringify(record.errors, null, 2));
await browser.close();
