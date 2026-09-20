import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { root, uvBin } from "./support.js";

/**
 * 面一（人设）+ 面三（互动健康度四态）的真实浏览器走查（T-033）。
 *
 * 数据来自后端 T-032 的 6 个 `ca_display_*` 合成场景（一一对应 xlsx 表 6 的 mock
 * 账号），经 `inject_fixture` 注入；不拦截、不伪造 API 响应。健康度四态的分支与
 * 文案判定由 `frontend/unit/companion.test.js` 盯住，这里验的是真实渲染结果。
 */

const SHOTS = path.join(root, ".trellis", "tasks", "T-033", "shots");
const FOOTER = "这是互动情况的提示，不是对孩子的评价。";

const phone = () =>
  "136" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (label) =>
  `e2e-t033-${label}-${Math.random().toString(16).slice(2, 10)}`;

async function login(page, number = phone()) {
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill(number);
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
}

async function child(page, name) {
  await page.getByLabel("姓名或称呼").fill(name);
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/children") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  const id = (await (await response).json()).id;
  // 建档成功后应用会自己跳到探索页：不等它落稳，后面的 hash 导航会被它覆盖。
  await expect(
    page.getByRole("heading", { name: "好奇心，准备出发！" }),
  ).toBeVisible();
  return id;
}

function inject(id, scenario) {
  execFileSync(
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
  );
}

/** 走真实 UI 把机器人绑上（展示面要有一个 `active` 的 CA 账户才取得到数据）。 */
async function bindRobot(page) {
  const mine = token("bind");
  await page.goto(`/?nfc_token=${mine}`);
  const dialog = page.locator("#dialog");
  await expect(
    dialog.getByRole("heading", { name: "绑定机器人" }),
  ).toBeVisible();
  await dialog.getByLabel("机器人凭据").fill(mine);
  const pending = page.waitForResponse(
    (r) => r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "确认绑定" }).click();
  await pending;
}

/** 走真实 UI 同意「机器人数据同步」用途（展示面的 `_resolve` 要这张授权）。 */
async function grantSync(page, id) {
  await nav(page, "账户与关联");
  await page.getByRole("button", { name: "核验并关联", exact: true }).click();
  await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
  await page.getByLabel("核验凭据", { exact: true }).fill("TEST-PROOF-" + id);
  const pending = page.waitForResponse((r) =>
    r.url().endsWith("/associations/verify"),
  );
  await page.getByRole("button", { name: "确认核验", exact: true }).click();
  await pending;
  // 核验成功后重新取一遍页面：同一个 hash 再点导航不会触发重渲染。
  await page.reload();
  await expect(
    page.locator(".key-value", { hasText: "机器人数据同步" }),
  ).toContainText("已同意");
}

async function nav(page, name) {
  await page
    .locator("#main-nav")
    .getByRole("link", { name, exact: true })
    .click();
}

async function openReports(page) {
  // 同一个 hash 的 goto 不会重新取数，每轮都必须真正重载一次才能看到新注入的场景。
  await page.goto("/#reports");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "陪学伙伴", exact: true }),
  ).toBeVisible();
}

/** 6 个合成场景对应的期望界面（表 6 最后一列的预期答案）。 */
const CASES = [
  {
    scenario: "ca_display_normal_art",
    shot: "normal-art",
    persona: { name: "Mia", type: "艺术", description: "艺术创作陪学伙伴", match: "82" },
    health: { label: "互动情况正常", score: "82", days: "15" },
  },
  {
    scenario: "ca_display_normal_science",
    shot: "normal-science",
    persona: { name: "Newton", type: "科学", description: "科学探索陪学伙伴", match: "88" },
    health: { label: "互动情况正常", score: "88", days: "30" },
  },
  {
    scenario: "ca_display_watch",
    shot: "watch",
    persona: { name: "Socrates", type: "哲学", description: "哲学思辨陪学伙伴", match: "85" },
    health: { label: "继续体验并观察", score: null, days: "15", reason: "近期互动偏少" },
  },
  {
    scenario: "ca_display_reassess",
    shot: "reassess",
    persona: { name: "Newton", type: "科学", description: "科学探索陪学伙伴", match: "73" },
    health: { label: "建议重新测评", score: null, days: "21", reason: "连续多期互动偏少" },
  },
  {
    scenario: "ca_display_new_user",
    shot: "new-user",
    persona: { name: "Homer", type: "语言", description: "语言表达陪学伙伴", match: "79" },
    health: { label: "还在收集互动数据，暂时不做判断。", score: null, days: "3" },
  },
  {
    scenario: "ca_display_switch",
    shot: "switch",
    persona: { name: "Mia", type: "艺术", description: "艺术创作陪学伙伴", match: "69" },
    health: { label: "建议重新测评", score: null, days: "30", reason: "连续多期互动偏少" },
  },
];

async function assertCase(page, item) {
  const panel = page.locator(".companion-panel");
  const persona = panel.locator(".companion-persona");
  const health = panel.locator(".companion-health");

  await expect(panel).toContainText(FOOTER);
  // 2026-09-20 拍板：家长端不再显示合成标注（testTag 空实现）。
  await expect(panel.locator(".tag.test")).toHaveCount(0);

  // 面一：人设卡
  await expect(persona).toContainText(item.persona.name);
  await expect(persona).toContainText(item.persona.type);
  await expect(persona).toContainText(item.persona.description);
  await expect(persona.locator(".metric-list")).toContainText("匹配度");
  await expect(persona.locator(".metric-list")).toContainText(item.persona.match);
  await expect(persona).toContainText("不是能力评价");
  await expect(persona).toContainText("学习风格：");

  // 面三：四态分支
  await expect(health).toContainText(item.health.label);
  if (item.health.reason) await expect(health).toContainText(item.health.reason);
  const scores = health.locator(".metric-list");
  if (item.health.score === null) {
    // 不显分数：连"0 分"都不许出现，只给观察天数。
    await expect(scores).toHaveCount(0);
    await expect(health).toContainText(`已观察 ${item.health.days} 天。`);
  } else {
    await expect(scores).toContainText("健康度分数");
    await expect(scores).toContainText(item.health.score);
    await expect(scores).toContainText("观察天数");
    await expect(scores).toContainText(item.health.days);
  }
  return { panel, health };
}

test("6 个合成场景逐个走查：人设卡与健康度四态（真实 Chrome）", async ({
  page,
}) => {
  test.setTimeout(420000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  fs.mkdirSync(SHOTS, { recursive: true });

  await login(page);
  const id = await child(page, "展示面走查儿童");

  // 还没有机器人账户：这一面要说"没绑定"，且不显示任何数值。
  await openReports(page);
  await expect(page.locator(".companion-persona")).toContainText(
    "还没有绑定机器人",
  );
  await expect(page.locator(".companion-persona")).toContainText(
    "绑定后这里会显示陪伴数据。",
  );
  await expect(page.locator(".companion-health")).toContainText(
    "还没有绑定机器人",
  );
  await expect(page.locator(".companion-health .metric-list")).toHaveCount(0);
  await expect(page.locator(".companion-health button, .companion-health a")).toHaveCount(
    1,
  );
  await page.screenshot({
    path: path.join(SHOTS, "unbound-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  // 核验用的身份输入先注入（`sync_success` 带 identity fixture），再走绑定与授权。
  inject(id, "sync_success");
  await bindRobot(page);
  await grantSync(page, id);

  for (const item of CASES) {
    inject(id, item.scenario);
    await openReports(page);
    const { health } = await assertCase(page, item);
    if (item.health.score === null && item.scenario === "ca_display_watch") {
      // H03 只给轻提示，不出复测 CTA。
      await expect(health.locator("button, a")).toHaveCount(0);
    }
    await page.screenshot({
      path: path.join(SHOTS, `${item.shot}-desktop.png`),
      fullPage: true,
      animations: "disabled",
    });
  }

  expect(errors).toEqual([]);
});

test("陪学伙伴面板：390×844 不横向溢出，账户页有只读人设行", async ({
  page,
}) => {
  test.setTimeout(420000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  fs.mkdirSync(SHOTS, { recursive: true });

  await login(page);
  const id = await child(page, "展示面窄屏儿童");
  inject(id, "sync_success");
  await bindRobot(page);
  await grantSync(page, id);
  inject(id, "ca_display_reassess");

  // 账户页：只读的当前人设名（与 T-015 给儿童详情加只读行同一手法）。
  await page.goto("/#settings");
  await page.reload();
  const robot = page.locator(".panel", { hasText: "机器人账户" });
  await expect(robot).toContainText("当前陪学伙伴");
  await expect(robot).toContainText("Newton");
  await expect(robot).toContainText("只读，由机器人服务下发");

  await page.setViewportSize({ width: 390, height: 844 });
  await openReports(page);
  await expect(page.locator(".companion-health")).toContainText("建议重新测评");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: path.join(SHOTS, "reassess-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });

  expect(errors).toEqual([]);
});
