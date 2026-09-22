import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { root, shell, uvBin } from "./support.js";

/**
 * 面二（15 / 30 天周期成长报告）的真实浏览器走查（T-034）。
 *
 * 数据来自后端 T-032 的 `ca_display_*` 合成场景（经 `inject_fixture` 注入）与
 * 一次针对"缺失维度"单独改写的 fixture 行；不拦截、不伪造 API 响应。呈现判定
 * 由 `frontend/unit/growth-cycle.test.js` 盯住，这里验的是真实渲染结果。
 */

const SHOTS = path.join(root, ".trellis", "tasks", "T-034", "shots");
const PROXY_NOTE = "成长代理由机器人服务算法产出，不是能力评分。";
const STALE_NOTICE = "最近一次同步没有成功，下面是上次成功同步的内容。";
const PERIOD_INCOMPLETE = "成长周期还没走完，满 15 天后会生成第一份周期报告。";
const NO_PERIOD_DATA = "这个周期还没有报告。";
const DIMS = [
  ["语言成长代理", "64"],
  ["逻辑成长代理", "48"],
  ["音乐成长代理", "66"],
  ["空间成长代理", "62"],
  ["实践成长代理", "44"],
  ["自我认知成长代理", "57"],
  ["人际成长代理", "51"],
  ["自然成长代理", "42"],
];

const phone = () =>
  "137" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (label) =>
  `e2e-t034-${label}-${Math.random().toString(16).slice(2, 10)}`;

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

/** 注入场景；展示面场景会打印 CA 账户号，按账户号改 fixture 时要用。 */
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
  const ready = out.match(/Display scenario ready: \S+ for (\S+)/);
  return ready ? ready[1] : null;
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

/** 切到指定 Tab；换 Tab 会真的重新取该周期的报告。 */
async function selectTab(page, label) {
  const period = label === "15 天" ? "15d" : "30d";
  const pending = page.waitForResponse((r) =>
    r.url().includes(`/growth-cycle?period=${period}`),
  );
  await page
    .locator(".growth-panel .growth-tabs")
    .getByRole("button", { name: label, exact: true })
    .click();
  await pending;
  await expect(
    page
      .locator(".growth-panel .growth-tabs")
      .getByRole("button", { name: label, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
}

async function openReports(page) {
  // 同一个 hash 的 goto 不会重新取数，每轮都必须真正重载一次才能看到新注入的场景。
  await page.goto("/#reports");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "成长周期报告", exact: true }),
  ).toBeVisible();
}

async function shot(page, name) {
  await page.screenshot({
    path: path.join(SHOTS, name),
    fullPage: true,
    animations: "disabled",
  });
}

/** 空态：不许出现任何数值，也不许出现八维条形。 */
async function expectNoNumbers(page) {
  const panel = page.locator(".growth-panel");
  await expect(panel.locator(".metric-list")).toHaveCount(0);
  await expect(panel.locator(".growth-dimensions")).toHaveCount(0);
  await expect(panel.locator("progress")).toHaveCount(0);
}

test("成长周期报告：15/30 天 Tab、周期空态与八维条形（真实 Chrome）", async ({
  page,
}) => {
  test.setTimeout(600000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  fs.mkdirSync(SHOTS, { recursive: true });

  await login(page);
  const id = await child(page, "周期报告走查儿童");

  const panel = page.locator(".growth-panel");

  // 0a) 还没有机器人账户：说没绑定，给去「账户与关联」的入口，不出任何数值。
  await openReports(page);
  await expect(panel).toContainText("还没有绑定机器人");
  await expect(panel).toContainText("绑定后这里会显示陪伴数据。");
  await expect(panel.locator("a", { hasText: "管理关联与授权" })).toHaveCount(1);
  await expectNoNumbers(page);
  await shot(page, "unbound-desktop.png");

  inject(id, "sync_success");
  await bindRobot(page);

  // 0b) 绑上了但还没同意「机器人数据同步」用途：说的是没授权，不是没数据。
  await openReports(page);
  await expect(panel).toContainText("尚未同意机器人数据同步用途");
  await expect(panel).not.toContainText("暂无");
  await expectNoNumbers(page);
  await shot(page, "no-consent-desktop.png");

  await grantSync(page, id);

  // 1) 新用户：绑定不满一个周期，对方没有周期报告。
  inject(id, "ca_display_new_user");
  await openReports(page);
  await expect(panel).toContainText(PERIOD_INCOMPLETE);
  await expect(panel).not.toContainText(NO_PERIOD_DATA);
  await expect(panel.locator(".tag.test")).toHaveCount(0);
  await expectNoNumbers(page);
  await shot(page, "new-user-desktop.png");

  // 2) 正常 15 天：陪伴值增长、阶段中文名与进度、八维条形。
  const account = inject(id, "ca_display_normal_art");
  await openReports(page);
  await expect(panel).toContainText("本周期 2026/09/01 — 2026/09/15");
  await expect(panel).toContainText("当前陪学伙伴 Mia");
  await expect(panel.locator(".metric-list")).toContainText("陪伴值增长");
  await expect(panel.locator(".metric-list")).toContainText("35");
  await expect(panel).toContainText("周期初 12 → 周期末 47");
  await expect(panel.locator(".growth-stage")).toContainText("成长");
  await expect(panel.locator(".growth-stage")).toContainText("阶段进度 55%");
  await expect(panel).toContainText(PROXY_NOTE);
  await expect(panel.locator(".growth-dimensions li")).toHaveCount(8);
  for (const [label, value] of DIMS) {
    const row = panel.locator(".growth-dimensions li", { hasText: label });
    await expect(row).toContainText(label);
    await expect(row.locator("strong")).toHaveText(value);
    await expect(row.locator("progress")).toHaveAttribute("value", value);
  }
  // 「成长周期报告」在既有「成长观察」之上（两份数据、两个来源，不合并）。
  const cycleBox = await panel.boundingBox();
  const observeBox = await page
    .getByRole("heading", { name: "成长观察", exact: true })
    .boundingBox();
  expect(cycleBox.y).toBeLessThan(observeBox.y);
  await shot(page, "normal-15d-desktop.png");

  // 3) 切到 30 天：这个场景没有 30 天报告，按空态说"周期还没走完"，不出 0。
  await selectTab(page, "30 天");
  await expect(panel).toContainText(PERIOD_INCOMPLETE);
  await expectNoNumbers(page);
  await shot(page, "tab-30d-empty-desktop.png");

  // 4) 把绑定时间推到 20 天前：这时"对方没有这个周期"要换成另一句说法。
  shell(
    `from django.utils import timezone; import datetime; from dingdong_ca.core.ca_models import CaAccount; CaAccount.objects.filter(ca_account_id="${account}").update(bound_at=timezone.now() - datetime.timedelta(days=20)); print("backdated")`,
  );

  // 5) 正常 30 天（对方只给了 30 天这一份）。
  inject(id, "ca_display_normal_science");
  await openReports(page);
  await selectTab(page, "30 天");
  await expect(panel).toContainText("本周期 2026/09/01 — 2026/09/30");
  await expect(panel).toContainText("当前陪学伙伴 Newton");
  await expect(panel.locator(".metric-list")).toContainText("64");
  await expect(panel.locator(".growth-stage")).toContainText("深入");
  await expect(panel.locator(".growth-stage")).toContainText("阶段进度 62%");
  await expect(
    panel.locator(".growth-dimensions li", { hasText: "逻辑成长代理" }).locator("strong"),
  ).toHaveText("79");
  await shot(page, "normal-30d-desktop.png");

  // 6) 切到 15 天：绑定已满 15 天，空态换成"这个周期还没有报告"。
  await selectTab(page, "15 天");
  await expect(panel).toContainText(NO_PERIOD_DATA);
  await expect(panel).not.toContainText(PERIOD_INCOMPLETE);
  await expectNoNumbers(page);

  // 7) 缺失维度：本周期无该维度数据，不补 0、不插值。
  inject(id, "ca_display_normal_art");
  shell(
    `from dingdong_ca.core.services.ca_display import FIXTURE_DATASET, GROWTH_KIND; from dingdong_ca.testsupport.models import TestFixture; row = TestFixture.objects.filter(dataset=FIXTURE_DATASET, kind=GROWTH_KIND, subject_key="${account}").order_by("sequence").first(); payload = row.payload; payload["growth_dimensions"]["logical"] = None; payload["growth_dimensions"]["spatial"] = None; row.payload = payload; row.save(update_fields=["payload"]); print(row.payload["growth_dimensions"])`,
  );
  await openReports(page);
  await expect(panel.locator(".growth-dimensions li.missing")).toHaveCount(2);
  for (const label of ["逻辑成长代理", "空间成长代理"]) {
    const row = panel.locator(".growth-dimensions li.missing", { hasText: label });
    await expect(row).toContainText("本周期无该维度数据");
    await expect(row.locator("progress")).toHaveCount(0);
    await expect(row.locator("strong")).toHaveCount(0);
  }
  // 其余六维原样显示，没有被 0 顶替。
  await expect(panel.locator(".growth-dimensions li:not(.missing)")).toHaveCount(6);
  await expect(
    panel.locator(".growth-dimensions li", { hasText: "语言成长代理" }).locator("strong"),
  ).toHaveText("64");
  await shot(page, "partial-dims-desktop.png");

  // 8) 窄屏：八维条形与缺失行都不横向溢出。
  await page.setViewportSize({ width: 390, height: 844 });
  await openReports(page);
  await expect(panel.locator(".growth-dimensions li")).toHaveCount(8);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await shot(page, "growth-mobile-390.png");

  // 9) 陈旧：最近一次同步失败，显示上次成功的周期报告并标注。
  // 视口要显式还原：上一步把它改成了 390×844，改视口不会随 reload 复位。
  await page.setViewportSize({ width: 1280, height: 720 });
  shell(
    `from dingdong_ca.testsupport.ca_display import inject_display_fault; print(inject_display_fault("${id}", "50001"))`,
  );
  await openReports(page);
  await expect(panel).toContainText(STALE_NOTICE);
  await expect(panel.locator(".metric-list")).toContainText("35");
  await expect(panel.locator(".growth-dimensions li")).toHaveCount(8);
  await shot(page, "stale-desktop.png");

  expect(errors).toEqual([]);
});
