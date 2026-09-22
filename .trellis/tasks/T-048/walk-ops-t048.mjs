/**
 * T-048 验收走查（O-15/O-16）运营端。真实 Chrome，不拦截、不伪造任何响应。
 *
 * O-16：题库列表 + 详情「用途」显示「初始测评」，无「（测试）」。
 * O-15：归档旧号后儿童详情「同步」列显示「已停用」，整页无「未知（」。
 */
import fs from "node:fs";
import path from "node:path";

const root = "/Users/yihu/Documents/ChatGPT/叮咚";
const { createRequire } = await import("node:module");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("playwright");

const BASE = "http://127.0.0.1:8017";
const OUT = path.join(root, ".trellis/tasks/T-048");
const SHOTS = path.join(OUT, "shots");
fs.mkdirSync(SHOTS, { recursive: true });

const CHILD_ID = "72fcdc16-0501-4e5b-bd3d-b2f5857a9a5c";

const record = { checks: [], errors: [], failed: [] };
function check(name, ok, detail) {
  record.checks.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name} ${detail ?? ""}`);
}
function save() {
  fs.writeFileSync(path.join(OUT, "walk-ops-t048.json"), JSON.stringify(record, null, 2));
}
async function shot(page, name) {
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: true, animations: "disabled" });
}
async function body(page) {
  return (await page.locator("body").innerText().catch(() => "")).replace(/\n{3,}/g, "\n\n");
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
await page.locator("input[name=username]").fill("t048walk");
await page.locator("input[name=password]").fill("T048-walk-tmp-8a2d");
await page.locator("form button[type=submit]").click();
await page.waitForTimeout(1500);
const landed = page.url();
check("ops login lands on dashboard", landed.includes("/ops/"), landed);
save();

// ---- O-16 列表 ----
{
  const resp = await page.goto(`${BASE}/ops/questionnaires/`);
  await page.waitForTimeout(1100);
  await shot(page, "t048-o16-questionnaires-list");
  const text = await body(page);
  check("O-16 list shows 初始测评", text.includes("初始测评"));
  check("O-16 list has no （测试）", !text.includes("（测试）"));
  // 找到「初始测评」所在行里的详情链接，进入详情页
  const row = page.locator("tbody tr", { hasText: "初始测评" }).first();
  const href = await row.locator("a[href*='/ops/questionnaires/']").first().getAttribute("href").catch(() => null);
  record.checks.push({ name: "O-16 list detail link", ok: !!href, detail: href });
  console.log(`${href ? "PASS" : "FAIL"} O-16 list detail link ${href ?? ""}`);
  if (href) {
    await page.goto(`${BASE}${href}`);
    await page.waitForTimeout(1100);
    await shot(page, "t048-o16-questionnaire-detail");
    const dtext = await body(page);
    check("O-16 detail shows 初始测评", dtext.includes("初始测评"));
    check("O-16 detail has no （测试）", !dtext.includes("（测试）"));
  }
}

// ---- O-15 儿童详情（归档旧号 → 同步列 blocked） ----
{
  const resp = await page.goto(`${BASE}/ops/children/${CHILD_ID}/`);
  await page.waitForTimeout(1100);
  await shot(page, "t048-o15-child-detail-blocked");
  const text = await body(page);
  check("O-15 child detail shows 已停用", text.includes("已停用"));
  check("O-15 child detail has no 未知（", !text.includes("未知（"));
  check("O-15 child detail http 200", resp && resp.status() === 200, `status=${resp && resp.status()}`);
}

save();
console.log("FAILED", JSON.stringify(record.failed, null, 2));
console.log("ERRORS", JSON.stringify(record.errors, null, 2));
await browser.close();
