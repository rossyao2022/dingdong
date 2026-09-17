/**
 * 快速视觉检查：登录页 + 若干后台页面截图（本地真实 Chrome，不拦截接口）。
 * 用法：cd frontend && OPS_USER=… OPS_PASS=… node tools/ops-quick-shots.mjs <输出目录> [页面路径...]
 *
 * 与 tools/ops-page-audit.mjs 的分工：本脚本只截图，适合改一处看一眼；
 * 要全站逐页体检并收集错误用 ops-page-audit.mjs。
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const outDir = process.argv[2] || "/tmp/dd-shots";
const paths = process.argv.slice(3);
const BACKEND = process.env.OPS_BACKEND_URL || "http://127.0.0.1:8017";
const USER = process.env.DD_OPS_ADMIN_USER;
const PW = process.env.DD_OPS_ADMIN_PW;

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ channel: "chrome" });
const errors = [];

async function shot(page, name, url, full = true) {
  await page.goto(`${BACKEND}${url}`, { waitUntil: "load" });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: full });
  console.log("shot", name);
}

const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text()}`);
});
page.on("response", (r) => {
  if (r.status() >= 400) errors.push(`http ${r.status()} ${r.url()}`);
});

await shot(page, "00-login", "/ops/login/");

if (USER && PW) {
  await page.locator("#id_username").fill(USER);
  await page.locator("#id_password").fill(PW);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.waitForURL(/\/ops\/$/);
  try {
    await page.waitForFunction(() => document.documentElement.dataset.opsReady === "1", null, {
      timeout: 8000,
    });
  } catch (error) {
    console.log("!! data-ops-ready 未出现，症状：", errors.join("\n"));
    await page.screenshot({ path: join(outDir, "99-not-ready.png"), fullPage: true });
    throw error;
  }
  await shot(page, "01-dashboard", "/ops/");
  for (const [i, p] of paths.entries()) {
    await shot(page, `${String(i + 10).padStart(2, "0")}-${p.replace(/[^\w]+/g, "-")}`, p);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await shot(page, "90-mobile-dashboard", "/ops/");
} else {
  console.log("未提供 DD_OPS_ADMIN_USER/DD_OPS_ADMIN_PW，跳过后台页面");
}

await browser.close();
console.log("errors:", errors.length ? errors.join("\n") : "none");
