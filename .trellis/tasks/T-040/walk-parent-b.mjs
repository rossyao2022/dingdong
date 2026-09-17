/**
 * T-040 产品巡检：第二个家庭（儿童乙）走查。
 *
 * 目的：①T-037 端到端复核——另一个儿童对同一 event_id（reassess_mock_001）再回写一次；
 * ②核验关联的错凭据路径（家长输错凭据时看到什么）与正确凭据路径（用 inject_fixture 真实凭据）。
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = "/Users/yihu/Documents/ChatGPT/叮咚";
const { createRequire } = await import("node:module");
const require = createRequire(path.join(root, "frontend/package.json"));
const { chromium } = require("playwright");

const BASE = process.env.T040_BASE || "http://127.0.0.1:4173";
const SHOTS = path.join(root, `.trellis/tasks/T-040/shots${process.env.T040_SHOTDIR || ""}`);
fs.mkdirSync(SHOTS, { recursive: true });

const log = [];
function note(step, extra = {}) {
  const row = { step, ...extra };
  log.push(row);
  console.log("STEP", step, JSON.stringify(extra).slice(0, 700));
}

function uvBin() {
  const candidates = [
    path.join(os.homedir(), ".local/bin/uv"),
    "/opt/homebrew/bin/uv",
    "/usr/local/bin/uv",
  ];
  return candidates.find((c) => fs.existsSync(c)) || "uv";
}

function manage(...args) {
  return execFileSync(
    uvBin(),
    ["run", "--no-sync", "--directory", path.join(root, "backend"), "python", "manage.py", ...args],
    { cwd: root },
  ).toString();
}

const phone = () => "139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (l) => `t040-${l}-${Math.random().toString(16).slice(2, 10)}`;

const errors = [];
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

async function shot(name) {
  await page.screenshot({
    path: path.join(SHOTS, `${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}
const mainText = async () =>
  (await page.locator("#main").innerText().catch(() => "")).replace(/\n{3,}/g, "\n\n").slice(0, 4000);

let childId = null;

// 1. 登录 + 建档
await page.goto(`${BASE}/`);
await page.waitForTimeout(700);
await page.getByLabel("手机号", { exact: true }).fill(phone());
await page.getByRole("button", { name: "获取验证码", exact: true }).click();
await page.waitForTimeout(1300);
const smsErr = await page.locator(".notice.error, .error").first().innerText().catch(() => "");
await page.getByLabel("验证码", { exact: true }).fill("00000");
await page.getByRole("button", { name: "登录", exact: true }).click();
await page.waitForTimeout(1600);
note("yi login", { smsError: smsErr, url: page.url(), text: (await mainText()).slice(0, 200) });

await page.getByLabel("姓名或称呼").fill("巡检乙");
const created = page.waitForResponse(
  (r) => r.url().endsWith("/api/v1/children") && r.request().method() === "POST",
);
await page.getByRole("button", { name: "保存档案", exact: true }).click();
childId = (await (await created).json()).id;
await page.waitForTimeout(1400);
note("yi child created", { childId });

// 2. 绑定机器人
const bindTok = token("yi");
await page.goto(`${BASE}/?nfc_token=${bindTok}`);
await page.waitForTimeout(1400);
await page.locator("#dialog").getByLabel("机器人凭据").fill(bindTok);
const bound = page.waitForResponse(
  (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
);
await page.locator("#dialog").getByRole("button", { name: "确认绑定" }).click();
note("yi bind status", { status: (await bound).status() });
await page.waitForTimeout(1200);

// 3. 同一 event_id 的第二次回写
note("inject yi", { acct: manage("inject_fixture", "--child-id", childId, "--scenario", "ca_display_reassess").trim() });
await page.goto(`${BASE}/#reports`);
await page.reload();
await page.waitForTimeout(2000);
await shot("05-yi-reports-reassess");
const yiText = await mainText();
note("yi reports", {
  hasThisSuggestionReason: yiText.includes("这次建议的原因"),
  countOldReasonLabel: (yiText.match(/机器人服务给出的原因/g) || []).length,
  text: yiText,
});

const declineResp = page.waitForResponse(
  (r) => r.url().includes("/reassessment/") && r.url().endsWith("/response"),
);
await page.getByRole("button", { name: "先不测", exact: true }).click();
const dr = await declineResp;
const yiDecline = { status: dr.status(), body: (await dr.text()).slice(0, 400) };
note("yi decline response", yiDecline);
await page.waitForTimeout(1500);
await shot("06-yi-after-decline");
note("yi after decline", { text: await mainText() });

// 4. 核验关联：错凭据路径
await page.goto(`${BASE}/#settings`);
await page.reload();
await page.waitForTimeout(1300);
await page.getByRole("button", { name: "核验并关联", exact: true }).click();
await page.waitForTimeout(600);
await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
await page.getByLabel("核验凭据", { exact: true }).fill("WRONG-PROOF-000");
const badResp = page.waitForResponse((r) => r.url().endsWith("/associations/verify"));
await page.getByRole("button", { name: "确认核验", exact: true }).click();
const br = await badResp;
await page.waitForTimeout(1200);
note("yi verify wrong proof", {
  status: br.status(),
  body: (await br.text()).slice(0, 400),
  dialogText: await page.locator("#dialog").innerText().catch(() => ""),
  mainText: (await mainText()).slice(0, 1200),
});
await shot("07-yi-verify-wrong-proof");

// 5. 核验关联：真实凭据路径
const injectOut = manage("inject_fixture", "--child-id", childId, "--scenario", "sync_success");
const proof = (injectOut.match(/Synthetic proof: (\S+)/) || [])[1] || null;
note("yi proof", { proof: proof ? proof.slice(0, 24) + "…" : null });

const dialogOpen = await page.locator("#dialog").isVisible().catch(() => false);
if (!dialogOpen) {
  await page.getByRole("button", { name: "核验并关联", exact: true }).click();
  await page.waitForTimeout(600);
}
await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
await page.getByLabel("核验凭据", { exact: true }).fill(proof || "");
const okResp = page.waitForResponse((r) => r.url().endsWith("/associations/verify"));
await page.getByRole("button", { name: "确认核验", exact: true }).click();
const okr = await okResp;
await page.waitForTimeout(1500);
note("yi verify real proof", { status: okr.status(), body: (await okr.text()).slice(0, 400) });
await shot("08-yi-settings-verified");

await page.goto(`${BASE}/#reports`);
await page.reload();
await page.waitForTimeout(2000);
await shot("09-yi-reports-after-verify");
note("yi reports after verify", { text: await mainText() });

await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/#reports`);
await page.reload();
await page.waitForTimeout(1500);
await shot("10-yi-reports-390");
note("yi mobile", {
  ...(await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))),
});

fs.writeFileSync(
  path.join(root, ".trellis/tasks/T-040/walk-parent-b.json"),
  JSON.stringify({ log, errors }, null, 2),
);
console.log("ERRORS", JSON.stringify(errors, null, 2));
await browser.close();
