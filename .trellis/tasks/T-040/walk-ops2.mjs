/**
 * T-040 产品巡检：运营后台补齐页走查（服务事项 / 账号与权限 / 改密码 / 详情页）。
 * 第一轮 walk-ops.mjs 用了几个不存在的路径（404 是我方脚本猜的 URL，不是缺陷），这里只走真实导航页。
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
  console.log("STEP", step, JSON.stringify(extra).slice(0, 700));
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

const pages = [
  ["services/", "ops2-01-services"],
  ["services/?status=open", "ops2-02-services-open"],
  ["accounts/", "ops2-03-accounts"],
  ["password/", "ops2-04-password"],
  ["questionnaires/", "ops2-05-questionnaires"],
  ["activities/", "ops2-06-activities"],
  ["reports/", "ops2-07-reports"],
  ["jobs/?status=failed", "ops2-08-jobs-failed"],
  ["ca-accounts/", "ops2-09-ca-accounts"],
  ["audit/", "ops2-10-audit"],
];

const detail = [];
for (const [p, name] of pages) {
  const resp = await page.goto(`${BASE}/ops/${p}`);
  await page.waitForTimeout(1100);
  await shot(page, name);
  const t = await body(page);
  note(`ops2 page ${p}`, { status: resp && resp.status(), text: t });
  const hrefs = await page
    .locator("a[href*='/ops/']")
    .evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  const picked = hrefs.filter(
    (h) => /\/(services|questionnaires|activities|reports|jobs|ca-accounts|accounts|families|children)\/[0-9a-f-]{36}\//.test(h || ""),
  );
  if (picked.length) detail.push([p, picked[0]]);
}

for (const [p, href] of detail) {
  const resp = await page.goto(`${BASE}${href}`);
  await page.waitForTimeout(1100);
  const name = `ops2-detail-${href.replace(/^\/ops\//, "").replace(/\//g, "-")}`;
  await shot(page, name);
  note(`ops2 detail ${href}`, { status: resp && resp.status(), text: await body(page) });
}

// 服务事项列表逐条看原因与状态
await page.goto(`${BASE}/ops/services/`);
await page.waitForTimeout(1100);
const rows = await page
  .locator("table tbody tr")
  .evaluateAll((rs) =>
    rs.slice(0, 10).map((r) => Array.from(r.querySelectorAll("td")).map((td) => td.innerText.trim())),
  );
note("ops2 service rows", { rows });

// 账号与权限页的表格
await page.goto(`${BASE}/ops/accounts/`);
await page.waitForTimeout(1100);
const acc = await page
  .locator("table tbody tr")
  .evaluateAll((rs) =>
    rs.slice(0, 10).map((r) => Array.from(r.querySelectorAll("td")).map((td) => td.innerText.trim())),
  );
note("ops2 account rows", { acc });

fs.writeFileSync(
  path.join(root, ".trellis/tasks/T-040/walk-ops2.json"),
  JSON.stringify({ log, errors }, null, 2),
);
console.log("ERRORS", JSON.stringify(errors, null, 2));
await browser.close();
