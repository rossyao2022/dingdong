// 运营后台逐页自检：真实 Chrome 打开每个页面，收集页面/控制台错误、关键结构钩子与截图。
//
// 用法（后端需已启动，见 backend/dingdong_ca/ops/README.md）：
//   cd frontend
//   OPS_USER=<运营账号> OPS_PASS=<密码> node tools/ops-page-audit.mjs /tmp/dd-audit
//
// 输出：<输出目录>/*.png 逐页整页截图，以及 report.json（含 ids / 每页结构计数 / 未处理错误）。
// 退出码恒为 0；要看结论请 grep 输出里的 FAIL 与 ⚠。
//
// 判读要点：
//   · 「裸控件」= 没有 form-control/form-select/form-check-input 类的 input/select/textarea。
//     改版后这个数应当为 0，出现非 0 说明有页面漏了组件库样式。
//   · 25-unknown-route 期望就是 404，标记为 ok*。本地 DEBUG=True 时看到的是 Django 调试页，
//     真实 404 页面要在部署环境验证。
//   · 依赖列表页里存在真实数据；详情页拿不到 id 时会 SKIP 而不是 FAIL。
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const BACKEND = process.env.OPS_BACKEND_URL || "http://127.0.0.1:8017";
const outDir = process.argv[2] || "/tmp/dd-audit";
fs.mkdirSync(outDir, { recursive: true });

const user = process.env.OPS_USER;
const pass = process.env.OPS_PASS;
if (!user || !pass) {
  console.error("缺少 OPS_USER / OPS_PASS");
  process.exit(1);
}

const PAGES = [
  ["01-dashboard", "/ops/"],
  ["02-families", "/ops/families/"],
  ["03-family-detail", "/ops/families/{family}/"],
  ["04-child-detail", "/ops/children/{child}/"],
  ["05-questionnaires", "/ops/questionnaires/"],
  ["06-questionnaire-new", "/ops/questionnaires/new/"],
  ["07-questionnaire-edit", "/ops/questionnaires/{questionnaire}/"],
  ["08-questionnaire-preview", "/ops/questionnaires/{questionnaire}/preview/"],
  ["09-activities", "/ops/activities/"],
  ["10-activity-new", "/ops/activities/new/"],
  ["11-activity-edit", "/ops/activities/{activity}/"],
  ["12-activity-preview", "/ops/activities/{activity}/preview/"],
  ["13-reports", "/ops/reports/"],
  ["14-report-detail", "/ops/reports/{report}/"],
  ["15-jobs", "/ops/jobs/"],
  ["16-job-detail", "/ops/jobs/{job}/"],
  ["17-services", "/ops/services/"],
  ["18-service-detail", "/ops/services/{service}/"],
  ["19-audit", "/ops/audit/"],
  ["20-accounts", "/ops/accounts/"],
  ["21-account-detail", "/ops/accounts/{account}/"],
  ["22-account-new", "/ops/accounts/new/"],
  ["23-account-reset", "/ops/accounts/{account_resettable}/reset-password/"],
  ["24-password", "/ops/password/"],
  ["25-unknown-route", "/ops/does-not-exist/"],
];

/**
 * 挑一个"可以重置密码"的目标账号。
 *
 * 运营后台按设计**不允许**重置自己、超级管理员和其他管理员的密码
 * （`views._modifiable`，与 /api/v1/staff/users 的保护一致），命中时返回 403
 * "权限不足"。这是正确行为，不是缺陷——但列表第一行通常正好是管理员，
 * 直接拿过来会把"设计如此"报成 FAIL，久了就没人看 FAIL 了。
 * 所以这里按角色徽章跳过管理员与当前账号，只要启用中的普通账号。
 */
async function pickResettableAccount(page) {
  await page.goto(BACKEND + "/ops/accounts/", { waitUntil: "domcontentloaded" });
  return page.evaluate(() => {
    const isAdminLabel = (text) => /管理员/.test(text); // 含"超级管理员"
    for (const row of document.querySelectorAll("tbody tr")) {
      const cellText = row.textContent || "";
      if (isAdminLabel(cellText) || cellText.includes("当前账号")) continue;
      const href = [...row.querySelectorAll("a[href]")]
        .map((a) => a.getAttribute("href"))
        .find((h) => /^\/ops\/accounts\/[0-9a-f-]{36}\/$/.test(h));
      if (href) return href.replace(/^\/ops\/accounts\//, "").replace(/\/$/, "");
    }
    return null;
  });
}

/** 从列表页收集第一行的目标 id，保证详情页有真实数据。 */
async function collectIds(page) {
  const ids = {};
  const pick = async (url, pattern, key) => {
    await page.goto(BACKEND + url, { waitUntil: "domcontentloaded" });
    const href = await page.evaluate((pat) => {
      const re = new RegExp(pat);
      const a = [...document.querySelectorAll("a[href]")].find((n) => re.test(n.getAttribute("href")));
      return a ? a.getAttribute("href") : null;
    }, pattern);
    // 只保留 uuid 段：/ops/<资源>/<uuid>/ -> <uuid>
    if (href) ids[key] = href.replace(/^\/ops\/[a-z-]+\//, "").replace(/\/$/, "");
  };
  await pick("/ops/families/", "^/ops/families/[0-9a-f-]{36}/$", "family");
  await pick("/ops/families/", "^/ops/children/[0-9a-f-]{36}/$", "child");
  await pick("/ops/questionnaires/", "^/ops/questionnaires/[0-9a-f-]{36}/$", "questionnaire");
  await pick("/ops/activities/", "^/ops/activities/[0-9a-f-]{36}/$", "activity");
  await pick("/ops/reports/", "^/ops/reports/[0-9a-f-]{36}/$", "report");
  await pick("/ops/jobs/", "^/ops/jobs/[0-9a-f-]{36}/$", "job");
  await pick("/ops/services/", "^/ops/services/[0-9a-f-]{36}/$", "service");
  await pick("/ops/accounts/", "^/ops/accounts/[0-9a-f-]{36}/$", "account");
  ids.account_resettable = await pickResettableAccount(page);
  // 儿童详情链接只在家庭详情页里；逐个家庭找，直到某个家庭有儿童档案
  if (!ids.child) {
    await pick("/ops/families/", "^/ops/families/[0-9a-f-]{36}/$", "__first_family");
    const families = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")]
        .map((n) => n.getAttribute("href"))
        .filter((h) => /^\/ops\/families\/[0-9a-f-]{36}\/$/.test(h))
        .slice(0, 12)
    );
    for (const href of families) {
      await pick(href, "^/ops/children/[0-9a-f-]{36}/$", "child");
      if (ids.child) break;
    }
    delete ids.__first_family;
  }
  return ids;
}

const browser = await chromium.launch({ channel: "chrome" });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
const page = await context.newPage();

const problems = [];
page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") problems.push("console: " + m.text());
});

// 登录
await page.goto(BACKEND + "/ops/login/", { waitUntil: "domcontentloaded" });
await page.locator("#id_username").fill(user);
await page.locator("#id_password").fill(pass);
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForURL(/\/ops\/$/);
await page.waitForSelector("html[data-ops-ready='1']");

const ids = await collectIds(page);
console.log("发现的目标 id：", JSON.stringify(ids));

const report = [];
for (const [name, raw] of PAGES) {
  const url = raw.replace(/\{(\w+)\}/g, (_, key) => ids[key] || "");
  if (url.includes("//") || /\{\w+\}/.test(url) || (/\/ops\/[a-z-]+\/$/.test(raw) && raw.includes("{") && !ids[raw.match(/\{(\w+)\}/)[1]])) {
    report.push({ name, url, status: "skipped", note: "没有可用于该页面的数据" });
    console.log(`${name.padEnd(26)} SKIP  ${url}`);
    continue;
  }
  const before = problems.length;
  const response = await page.goto(BACKEND + url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  const status = response ? response.status() : 0;
  const info = await page.evaluate(() => ({
    title: (document.querySelector("h1.ops-page-title") || {}).textContent || "",
    hasSidebar: !!document.querySelector("#ops-sidebar"),
    activeNav: (document.querySelector(".ops-nav-link[aria-current='page']") || {}).textContent || "",
    cards: document.querySelectorAll("section.card, .card").length,
    tables: document.querySelectorAll("table.ops-table").length,
    kv: document.querySelectorAll("dl.kv").length,
    timeline: document.querySelectorAll("ul.timeline li").length,
    empty: document.querySelectorAll(".empty").length,
    unstyledControls: [...document.querySelectorAll("input:not([type=hidden]), select, textarea")].filter(
      (n) => !/form-control|form-select|form-check-input/.test(n.className)
    ).length,
    opsJs: typeof window.Ops,
  }));
  await page.screenshot({ path: path.join(outDir, name + ".png"), fullPage: true });
  const newProblems = problems.slice(before);
  report.push({ name, url, status, ...info, problems: newProblems });
  // 25-unknown-route 期望就是 404（本地 DEBUG=True 时是 Django 调试页，线上走 ops/not_found.html）
  const expected404 = name === "25-unknown-route" && status === 404;
  const noise = expected404 ? 0 : newProblems.length;
  const flag = (status >= 400 && !expected404) || noise ? "FAIL" : expected404 ? "ok* " : "ok  ";
  console.log(
    `${name.padEnd(26)} ${flag} ${String(status).padEnd(4)} 标题="${info.title.trim()}" 卡片=${info.cards} 表格=${info.tables} 裸控件=${info.unstyledControls} Ops=${info.opsJs}`
  );
  newProblems.forEach((p) => console.log("      ⚠ " + p));
}

// 窄屏检查
await page.setViewportSize({ width: 390, height: 844 });
for (const [name, raw] of [["90-mobile-dashboard", "/ops/"], ["91-mobile-families", "/ops/families/"]]) {
  await page.goto(BACKEND + raw, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(250);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const toggle = await page.locator(".ops-menu-toggle").isVisible();
  await page.screenshot({ path: path.join(outDir, name + ".png"), fullPage: true });
  console.log(`${name.padEnd(26)} 横向溢出=${overflow}px 展开按钮可见=${toggle}`);
  if (overflow > 1) console.log("      ⚠ 窄屏出现横向溢出");
  if (!toggle) console.log("      ⚠ 窄屏没有展开导航按钮");
}

console.log("\n未处理错误总计：" + problems.length);
fs.writeFileSync(path.join(outDir, "report.json"), JSON.stringify({ ids, report, problems }, null, 2));
await browser.close();
