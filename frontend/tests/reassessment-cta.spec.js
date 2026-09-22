import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { root, shell, uvBin } from "./support.js";

/**
 * 面四（复测 CTA 与回写闭环）的真实浏览器走查（T-035）。
 *
 * 数据来自后端 T-032 的 `ca_display_reassess` / `ca_display_switch` 合成场景，
 * 经 `inject_fixture` 注入；不拦截、不伪造 API 响应。四步状态机与
 * `switch_recommended` 两个分支的判定由 `frontend/unit/reassessment.test.js`
 * 盯住，这里验的是真实渲染与真实回写。
 *
 * 已知约束：本地表 `ca_reassessment_event.event_id` 是**全局**唯一，而两个复测
 * mock 账号共用一份 fixture，所以同一个场景在全库只能被一个儿童回写一次（第二个
 * 儿童会在回写时撞唯一约束）。用例照「不写死测试数据」的纪律给每次注入换一个
 * 独有的 `event_id`，这样用例在任何库上都可重复跑。
 */

const SHOTS = path.join(root, ".trellis", "tasks", "T-035", "shots");
const SUGGEST = "最近一段时间互动偏少，要不要重新测一次？";
const DECLINED = "已选择暂不重新测评";

const phone = () =>
  "136" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (label) =>
  `e2e-t035-${label}-${Math.random().toString(16).slice(2, 10)}`;
const eventId = (label) =>
  `reassess-e2e-${label}-${Math.random().toString(16).slice(2, 10)}`;

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
  await expect(
    page.getByRole("heading", { name: "好奇心，准备出发！" }),
  ).toBeVisible();
  return id;
}

function inject(id, scenario) {
  return execFileSync(
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
}

/** 注入展示面场景并返回它的 `ca_account_id`（命令会打印 "…for <account_id>"）。 */
function injectDisplay(id, scenario) {
  const line = inject(id, scenario)
    .split("\n")
    .find((l) => l.startsWith("Display scenario ready:"));
  if (!line) throw new Error("没有拿到展示面场景的 ca_account_id：" + scenario);
  return line.trim().split(" for ").pop();
}

/** 把这次注入的合成事件换个独有 id（见文件头「已知约束」）。 */
function scopeEvent(accountId, unique) {
  shell(`from dingdong_ca.testsupport.models import TestFixture
from dingdong_ca.core.services.ca_display import FIXTURE_DATASET, REASSESSMENT_KIND
row = TestFixture.objects.get(dataset=FIXTURE_DATASET, kind=REASSESSMENT_KIND, subject_key="${accountId}", sequence=1)
row.payload["event"]["event_id"] = "${unique}"
row.save(update_fields=["payload"])
print("scoped")`);
  return unique;
}

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

async function grantSync(page, id) {
  await page.goto("/#settings");
  await page.reload();
  await page.getByRole("button", { name: "核验并关联", exact: true }).click();
  await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
  await page.getByLabel("核验凭据", { exact: true }).fill("TEST-PROOF-" + id);
  const pending = page.waitForResponse((r) =>
    r.url().endsWith("/associations/verify"),
  );
  await page.getByRole("button", { name: "确认核验", exact: true }).click();
  await pending;
  await page.reload();
  await expect(
    page.locator(".key-value", { hasText: "机器人数据同步" }),
  ).toContainText("已同意");
}

/** 同一个 hash 的 goto 不重新取数，每轮都要真正重载一次才看得到新注入的场景。 */
async function openReports(page) {
  await page.goto("/#reports");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "陪学伙伴", exact: true }),
  ).toBeVisible();
}

/** 点导航进「测评与报告」：走 hash 路由不重载，保住本轮会话里的回写结果。 */
async function navReports(page) {
  await page
    .locator("#main-nav")
    .getByRole("link", { name: "测评与报告", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "陪学伙伴", exact: true }),
  ).toBeVisible();
}

/** 走真实 UI 完成一次测评（22 题 + 合成样例），返回这次测评的 id。 */
async function completeAssessment(page) {
  await page.getByLabel("我已阅读并同意本次测评用途").check();
  await page.getByRole("button", { name: "同意并开始", exact: true }).click();
  await expect(page.getByText("第 1 / 22 题")).toBeVisible();
  const id = new URL(page.url()).hash.split("/")[1];
  for (let i = 1; i <= 22; i++) {
    await expect(page.getByText(new RegExp(`第 ${i} / 22 题`))).toBeVisible();
    await page.getByRole("radio").first().check();
    await page
      .getByRole("button", {
        name: i === 22 ? "保存并完成" : "保存并下一题",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByText("提交五张样例完成本次测评", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "提交样例", exact: true }).click();
  await expect(
    page.getByText("本次测评已处理完成", { exact: true }),
  ).toBeVisible({ timeout: 60000 });
  return id;
}

/** 登录 → 建档 → 绑机器人 → 同意同步 → 注入展示面场景（含测评合成输入）。 */
async function readyChild(page, name, scenario, label) {
  await login(page);
  const id = await child(page, name);
  inject(id, "sync_success");
  await bindRobot(page);
  await grantSync(page, id);
  inject(id, "assessment_success");
  const accountId = injectDisplay(id, scenario);
  return { id, event: scopeEvent(accountId, eventId(label)) };
}

test("复测四步闭环：建议 → 回写 → 承接测评 → 结果（switch_recommended 真分支）", async ({
  page,
}) => {
  test.setTimeout(900000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  fs.mkdirSync(SHOTS, { recursive: true });

  const { event } = await readyChild(
    page,
    "复测闭环儿童",
    "ca_display_switch",
    "switch",
  );

  // 第 1 步：健康度面板内展示建议（全产品唯一入口）。
  await openReports(page);
  const cta = page.locator(".companion-health .reassessment");
  await expect(cta).toHaveCount(1);
  await expect(page.locator(".reassessment")).toHaveCount(1);
  await expect(cta).toContainText(SUGGEST);
  await expect(cta).toContainText("建议时间");
  await expect(cta).toContainText("这次建议的原因：近期互动偏少");
  await expect(cta.getByRole("button")).toHaveCount(2);
  await page.screenshot({
    path: path.join(SHOTS, "suggest-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  // 第 2 步：回写选择。断言真实 POST 的入参与响应。
  const answered = page.waitForResponse((r) =>
    r.url().endsWith(`/reassessment/${event}/response`),
  );
  await cta.getByRole("button", { name: "重新测评", exact: true }).click();
  const response = await answered;
  expect(response.request().method()).toBe("POST");
  expect(response.request().postDataJSON().accepted).toBe(true);
  const body = await response.json();
  expect(body.accepted).toBe(true);
  expect(body.data_origin).toBe("synthetic");
  expect(body.sync_pending).toBe(false);

  await expect(page.locator(".reassessment")).toContainText("已确认重新测评");
  await expect(
    page.locator(".reassessment").getByRole("button", { name: "开始复测" }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(SHOTS, "accepted-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  // 第 3 步：承接既有测评流程（不新建第二套入口），跑完这一次测评。
  const completed = page.waitForResponse((r) =>
    r.url().endsWith(`/reassessment/${event}/complete`),
  );
  await page.getByRole("button", { name: "开始复测", exact: true }).click();
  const assessmentId = await completeAssessment(page);
  const writeBack = await completed;
  expect(writeBack.request().postDataJSON().assessment_id).toBe(assessmentId);
  const result = await writeBack.json();

  // 第 4 步：结果与新角色建议。
  expect(result.switch_recommended).toBe(true);
  expect(result.new_persona_name).toBe("Socrates");
  expect(result.match_score).toBe(86);
  expect(result.current_persona_match_score).toBe(69);
  expect(result.match_delta).toBe(17);
  expect(result.auto_switch).toBe(false);
  await expect(
    page.getByText("本次复测的结果已经回写。", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: path.join(SHOTS, "writeback-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  // 结果卡：先走 hash 路由（保住本轮会话里的 `complete` 响应，它有名字与分数）。
  await navReports(page);
  const card = page.locator(".reassessment");
  await expect(card).toContainText("新角色推荐");
  await expect(card).toContainText("Socrates");
  await expect(card).toContainText("匹配度 86 / 100");
  await expect(card).toContainText("当前角色匹配度");
  await expect(card).toContainText("69");
  await expect(card).toContainText("匹配度变化");
  await expect(card).toContainText("17");
  await expect(card).toContainText("确认入口尚未开放");
  // 没有任何自动切换：人设卡仍是原角色 Mia，结果卡上也没有切换按钮。
  const persona = page.locator(".companion-persona");
  await expect(persona).toContainText("Mia");
  await expect(persona).not.toContainText("Socrates");
  await expect(card.getByRole("button")).toHaveCount(0);
  await page.screenshot({
    path: path.join(SHOTS, "result-switch-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  // 刷新后拿不到 `complete` 响应（事件字段里没有分数），只说已回写，仍不自动切换。
  await openReports(page);
  await expect(card).toContainText("这次复测的结果已经回写。");
  await expect(card).toContainText("换不换陪学伙伴由你决定，我们不会自动更换。");
  await expect(card).not.toContainText("Socrates");
  await expect(persona).toContainText("Mia");
  await expect(persona).not.toContainText("Socrates");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(card).toContainText("这次复测的结果已经回写。");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: path.join(SHOTS, "result-switch-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });

  expect(errors).toEqual([]);
});

test("复测四步闭环：switch_recommended 假分支只保留当前角色", async ({
  page,
}) => {
  test.setTimeout(900000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  fs.mkdirSync(SHOTS, { recursive: true });

  const { event } = await readyChild(
    page,
    "复测保留儿童",
    "ca_display_reassess",
    "keep",
  );

  await openReports(page);
  const cta = page.locator(".companion-health .reassessment");
  await expect(cta).toContainText(SUGGEST);
  await cta.getByRole("button", { name: "重新测评", exact: true }).click();
  await expect(page.locator(".reassessment")).toContainText("已确认重新测评");

  const completed = page.waitForResponse((r) =>
    r.url().endsWith(`/reassessment/${event}/complete`),
  );
  await page.getByRole("button", { name: "开始复测", exact: true }).click();
  await completeAssessment(page);
  const result = await (await completed).json();
  expect(result.switch_recommended).toBe(false);
  expect(result.match_delta).toBe(6);
  expect(result.auto_switch).toBe(false);

  // 结果卡：先走 hash 路由（保住本轮会话里的 `complete` 响应）。
  await navReports(page);
  const card = page.locator(".reassessment");
  await expect(card).toContainText("保留当前角色");
  await expect(card).toContainText("当前角色匹配度");
  // 假分支不展示新角色名（fixture 里的 Ada 不许出现），也不出推荐卡。
  await expect(card).not.toContainText("Ada");
  await expect(card).not.toContainText("新角色推荐");
  await expect(page.locator(".companion-panel")).not.toContainText("Ada");
  // 原角色仍是 Newton。
  await expect(page.locator(".companion-persona")).toContainText("Newton");
  await page.screenshot({
    path: path.join(SHOTS, "result-keep-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  // 刷新后同样只说已回写，且仍然没有出现新角色名。
  await openReports(page);
  await expect(card).toContainText("这次复测的结果已经回写。");
  await expect(page.locator(".companion-panel")).not.toContainText("Ada");
  await expect(page.locator(".companion-persona")).toContainText("Newton");

  expect(errors).toEqual([]);
});

test("选择先不测后不再重复打扰，可展开看当时的建议；没有建议时不出现入口", async ({
  page,
}) => {
  test.setTimeout(600000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  fs.mkdirSync(SHOTS, { recursive: true });

  await login(page);
  const id = await child(page, "复测拒绝儿童");
  inject(id, "sync_success");
  await bindRobot(page);
  await grantSync(page, id);

  // 正常态（无待处理建议）：整块不出现，不留空框、不报错。
  injectDisplay(id, "ca_display_normal_art");
  await openReports(page);
  await expect(page.locator(".reassessment")).toHaveCount(0);
  await expect(page.locator(".companion-health")).toContainText("互动情况正常");

  const accountId = injectDisplay(id, "ca_display_reassess");
  const event = scopeEvent(accountId, eventId("decline"));
  await openReports(page);
  const declined = page.waitForResponse((r) =>
    r.url().endsWith(`/reassessment/${event}/response`),
  );
  await page
    .locator(".reassessment")
    .getByRole("button", { name: "先不测", exact: true })
    .click();
  expect((await declined).request().postDataJSON().accepted).toBe(false);

  const block = page.locator(".reassessment");
  await expect(block).toContainText(DECLINED);
  await expect(block).not.toContainText(SUGGEST);
  // 只剩「查看当时的建议」，不再出现第二个「重新测评」。
  await expect(block.getByRole("button")).toHaveCount(1);
  await block
    .getByRole("button", { name: "查看当时的建议", exact: true })
    .click();
  await expect(block).toContainText("这条建议已经处理过，不会重复提示。");
  await expect(block).toContainText("建议时间");
  await expect(block.getByRole("button")).toHaveCount(1);
  await page.screenshot({
    path: path.join(SHOTS, "declined-expanded-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  // 重载后仍是「已选择暂不重新测评」：回写落在我方库，不靠前端记忆。
  await openReports(page);
  await expect(page.locator(".reassessment")).toContainText(DECLINED);
  await expect(page.locator(".reassessment")).not.toContainText(SUGGEST);

  expect(errors).toEqual([]);
});
