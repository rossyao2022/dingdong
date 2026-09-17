/**
 * T-040 产品巡检（第三轮）：家长端走查（真实 Chrome）。
 *
 * 重点：复核 T-037（复测回写按账户唯一 + 失败落点 + 5xx 文案）、
 * T-038（P-11 原因标签 / P-12 学习风格中文 / P-13 单位 / P-14 时间口径 / P-15 来源说明）、
 * T-039（八维中文名由后端下发），以及「两个儿童先后回写同一 event_id」端到端。
 * 不拦截、不伪造任何 API 响应；单步失败不中断整轮。
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
const TAG = process.env.T040_TAG || "t040";
const SHOTS = path.join(root, `.trellis/tasks/T-040/shots${process.env.T040_SHOTDIR || ""}`);
const JSONL = path.join(root, `.trellis/tasks/T-040/${TAG}-parent.jsonl`);
fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(JSONL, "");

const log = [];
function note(step, extra = {}) {
  const row = { step, ...extra };
  log.push(row);
  fs.appendFileSync(JSONL, JSON.stringify(row) + "\n");
  console.log("STEP", step, JSON.stringify(extra).slice(0, 600));
}

function uvBin() {
  const candidates = [
    path.join(os.homedir(), ".local/bin/uv"),
    "/opt/homebrew/bin/uv",
    "/usr/local/bin/uv",
  ];
  return candidates.find((c) => fs.existsSync(c)) || "uv";
}

function inject(id, scenario) {
  const out = execFileSync(
    uvBin(),
    [
      "run",
      "--no-sync",
      "--directory",
      path.join(root, "backend"),
      "python",
      "manage.py",
      "inject_fixture",
      "--child-id",
      id,
      "--scenario",
      scenario,
    ],
    { cwd: root },
  ).toString();
  const line = out.split("\n").find((l) => l.startsWith("Display scenario ready:"));
  return line ? line.trim().split(" for ").pop() : null;
}

const phone = () => "138" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (l) => `t040-${l}-${Math.random().toString(16).slice(2, 10)}`;

const errors = [];

async function shot(page, name) {
  await page.screenshot({
    path: path.join(SHOTS, `${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

async function text(page) {
  return (await page.locator("#main").innerText().catch(() => ""))
    .replace(/\n{3,}/g, "\n\n")
    .slice(0, 4000);
}

async function step(page, label, fn) {
  try {
    await fn();
  } catch (e) {
    note(`FAILED ${label}`, { error: String(e).split("\n")[0].slice(0, 300) });
    await page
      .screenshot({
        path: path.join(SHOTS, `zz-failed-${label.replace(/[^a-z0-9-]/gi, "-")}.png`),
        fullPage: true,
      })
      .catch(() => {});
  }
}

async function route(page, hash, name, wait = 1200) {
  await page.goto(`${BASE}/${hash}`);
  await page.reload();
  await page.waitForTimeout(wait);
  await shot(page, name);
  note(`route ${hash}`, { name, text: await text(page) });
}

/** 登录 → 建档 → 绑定机器人 → 核验关联。返回 childId。 */
async function setUpChild(browser, tag, name) {
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${tag} pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${tag} console: ${m.text()}`);
  });

  const ph = phone();
  let childId = null;
  await step(page, `${tag}-login`, async () => {
    await page.goto(`${BASE}/`);
    await page.waitForTimeout(700);
    await page.getByLabel("手机号", { exact: true }).fill(ph);
    await page.getByRole("button", { name: "获取验证码", exact: true }).click();
    await page.waitForTimeout(1200);
    await page.getByLabel("验证码", { exact: true }).fill("00000");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await page.waitForTimeout(1600);
    await page.getByLabel("姓名或称呼").fill(name);
    const created = page.waitForResponse(
      (r) => r.url().endsWith("/api/v1/children") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "保存档案", exact: true }).click();
    childId = (await (await created).json()).id;
    await page.waitForTimeout(1400);
    note(`${tag} child created`, { childId, phone: ph, text: await text(page) });
  });

  await step(page, `${tag}-bind`, async () => {
    const bindTok = token(tag);
    await page.goto(`${BASE}/?nfc_token=${bindTok}`);
    await page.waitForTimeout(1400);
    const dialog = page.locator("#dialog");
    await dialog.getByLabel("机器人凭据").fill(bindTok);
    const bound = page.waitForResponse(
      (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
    );
    await dialog.getByRole("button", { name: "确认绑定" }).click();
    note(`${tag} bind status`, { status: (await bound).status() });
    await page.waitForTimeout(1200);

    await page.goto(`${BASE}/#settings`);
    await page.reload();
    await page.waitForTimeout(1200);
    await page.getByRole("button", { name: "核验并关联", exact: true }).click();
    await page.waitForTimeout(600);
    await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
    await page.getByLabel("核验凭据", { exact: true }).fill("TEST-PROOF-" + childId);
    const verified = page.waitForResponse((r) => r.url().endsWith("/associations/verify"));
    await page.getByRole("button", { name: "确认核验", exact: true }).click();
    note(`${tag} verify status`, { status: (await verified).status() });
    await page.waitForTimeout(1200);
  });

  return { ctx, page, childId };
}

const browser = await chromium.launch({ channel: "chrome" });

// ---------- 1. 儿童甲：复测场景 + 修复处复核 + 「先不测」回写 ----------
const a = await setUpChild(browser, "jia", "巡检甲");
note("inject jia", { acct: inject(a.childId, "ca_display_reassess") });

await step(a.page, "jia-reports-reassess", async () => {
  await route(a.page, "#reports", "01-jia-reports-reassess", 2000);
  const t = await text(a.page);
  const title = await a.page.title();
  note("jia fix probe", {
    pageTitle: title,
    hasThisSuggestionReason: t.includes("这次建议的原因"),
    countOldReasonLabel: (t.match(/机器人服务给出的原因/g) || []).length,
    hasChineseLearningStyle: /学习风格：.*(模仿|开放|逆向|认知)/.test(t),
    hasRawLearningCodeInBody: /学习风格：.*(imitation|open|reverse|cognitive)(?![^（]*）)/.test(t),
    countUnitCount: (t.match(/\bcount\b/g) || []).length,
    hasSourceNote: t.includes("这里是本机同步到的机器人行为观察"),
    hasIsoLikeTime: /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t),
    dimensionNames: ["语言", "逻辑", "音乐", "空间", "实践", "自我认知", "人际", "自然"].filter((d) =>
      t.includes(d),
    ),
    rawCodes: ["imitation", "open", "reverse", "cognitive", "count", "readable-v2"].filter((c) =>
      t.includes(c),
    ),
  });
  // 学习风格原 code 是否只出现在 title 属性里
  const styleTitle = await a.page
    .locator(".companion-persona .note", { hasText: "学习风格" })
    .first()
    .getAttribute("title")
    .catch(() => null);
  note("jia learning style note", { titleAttr: styleTitle });
  const dimText = await a.page.locator(".growth-panel").first().innerText().catch(() => "");
  note("jia growth panel text", { text: dimText.slice(0, 1500) });
});

let jiaDecline = null;
await step(a.page, "jia-decline", async () => {
  const resp = a.page.waitForResponse(
    (r) => r.url().includes("/reassessment/") && r.url().endsWith("/response"),
  );
  await a.page.getByRole("button", { name: "先不测", exact: true }).click();
  const r = await resp;
  jiaDecline = { status: r.status(), body: (await r.text()).slice(0, 600) };
  note("jia decline response", jiaDecline);
  await a.page.waitForTimeout(1500);
  await shot(a.page, "02-jia-after-decline");
  note("jia after decline", { text: await text(a.page) });
});

// ---------- 2. 儿童乙（另一个家庭）：同一 event_id 再回写一次 ----------
const b = await setUpChild(browser, "yi", "巡检乙");
note("inject yi", { acct: inject(b.childId, "ca_display_reassess") });

await step(b.page, "yi-reports-reassess", async () => {
  await route(b.page, "#reports", "03-yi-reports-reassess", 2000);
});

let yiDecline = null;
await step(b.page, "yi-decline", async () => {
  const resp = b.page.waitForResponse(
    (r) => r.url().includes("/reassessment/") && r.url().endsWith("/response"),
  );
  await b.page.getByRole("button", { name: "先不测", exact: true }).click();
  const r = await resp;
  yiDecline = { status: r.status(), body: (await r.text()).slice(0, 600) };
  note("yi decline response", yiDecline);
  await b.page.waitForTimeout(1500);
  await shot(b.page, "04-yi-after-decline");
  note("yi after decline", { text: await text(b.page) });
});
note("two-children same-event-id", {
  jia: jiaDecline && jiaDecline.status,
  yi: yiDecline && yiDecline.status,
  eventIds: [jiaDecline && jiaDecline.body, yiDecline && yiDecline.body],
});

// ---------- 3. 儿童甲：其余展示面场景 + 页面走查 ----------
await step(a.page, "jia-scenarios", async () => {
  for (const [scenario, name] of [
    ["ca_display_normal_art", "05-jia-normal-art"],
    ["ca_display_watch", "06-jia-watch"],
    ["ca_display_new_user", "07-jia-new-user"],
    ["ca_display_switch", "08-jia-switch"],
    ["ca_display_normal_science", "09-jia-science-30d"],
  ]) {
    inject(a.childId, scenario);
    await route(a.page, "#reports", name, 2000);
  }
});

await step(a.page, "jia-routes", async () => {
  for (const [hash, name] of [
    ["#home", "10-jia-home"],
    ["#explore", "11-jia-explore"],
    ["#journey", "12-jia-journey"],
    ["#services", "13-jia-services"],
    ["#settings", "14-jia-settings"],
    ["#support", "15-jia-support"],
  ]) {
    await route(a.page, hash, name, 1400);
  }
});

await step(a.page, "jia-mobile", async () => {
  await a.page.setViewportSize({ width: 390, height: 844 });
  for (const [hash, name] of [
    ["#reports", "16-jia-reports-390"],
    ["#home", "17-jia-home-390"],
    ["#settings", "18-jia-settings-390"],
  ]) {
    await a.page.goto(`${BASE}/${hash}`);
    await a.page.reload();
    await a.page.waitForTimeout(1400);
    await shot(a.page, name);
    const m = await a.page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }));
    note(`mobile ${hash}`, { name, ...m });
  }
  await a.page.setViewportSize({ width: 1440, height: 900 });
});

fs.writeFileSync(
  path.join(root, `.trellis/tasks/T-040/${TAG}-parent.json`),
  JSON.stringify({ log, errors }, null, 2),
);
console.log("ERRORS", JSON.stringify(errors, null, 2));
await browser.close();
