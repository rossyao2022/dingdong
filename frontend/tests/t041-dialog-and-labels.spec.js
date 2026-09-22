/**
 * T-041 的真实 Chrome 验收：P-16（复测承接对话框被轮询重渲染关掉）、P-17（核验
 * 失败显示内部错误码）与运营端 O-08/O-09/O-10/O-11 四条展示小项。
 *
 * P-16 走的是 T-040 巡检复现的原始路径：观察未就绪（`not_synced` / 阶段画像处理中）
 * 时 `#reports` 每 3 秒重渲染一次，点「开始复测」后对话框要能跨过至少一次轮询周期
 * 还开着，并且能继续完成「同意并开始」进入测评流程。断言的是请求计数与 `<dialog>.open`
 * 的真实状态，不是截图观感。
 *
 * 运营端四条用 Django shell 造一条「家长没填姓名」的家庭 + 一条英文代码活动，
 * 再打开真实页面；不拦截、不伪造任何接口响应。
 *
 * 前置：后端 8017 + Worker/Beat + PostgreSQL/Redis 在跑（同其它 spec）。
 */
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { root, shell, uvBin } from "./support.js";

const SHOTS = path.join(root, ".trellis", "tasks", "T-041", "shots");
const BACKEND = process.env.OPS_BACKEND_URL || "http://127.0.0.1:8017";
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const phone = () =>
  "137" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
const token = (label) =>
  `e2e-t041-${label}-${Math.random().toString(16).slice(2, 10)}`;
const eventId = (label) =>
  `reassess-t041-${label}-${Math.random().toString(16).slice(2, 10)}`;

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

/** 给这次注入的合成事件换一个独有 id，用例在任何库上都能重复跑（同 T-035）。 */
function scopeEvent(accountId, unique) {
  shell(`from dingdong_ca.testsupport.models import TestFixture
from dingdong_ca.core.services.ca_display import FIXTURE_DATASET, REASSESSMENT_KIND
row = TestFixture.objects.get(dataset=FIXTURE_DATASET, kind=REASSESSMENT_KIND, subject_key="${accountId}", sequence=1)
row.payload["event"]["event_id"] = "${unique}"
row.save(update_fields=["payload"])
print("scoped")`);
  return unique;
}

async function bindRobot(page, mine = token("bind")) {
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
  await expect(dialog).not.toBeVisible();
  return mine;
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

test("P-16：观察未就绪的轮询重渲染不再关掉复测承接对话框", async ({ page }) => {
  test.setTimeout(600000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  fs.mkdirSync(SHOTS, { recursive: true });

  // 记录 `#reports` 每轮渲染都会重取的接口：它是「跨过一次轮询周期」的客观证据。
  let overviewCalls = 0;
  page.on("request", (r) => {
    if (r.url().includes("/growth-overview")) overviewCalls++;
  });

  await login(page);
  const id = await child(page, "复测对话框儿童");
  inject(id, "sync_success");
  await bindRobot(page);
  await grantSync(page, id);
  const accountId = injectDisplay(id, "ca_display_reassess");
  const event = scopeEvent(accountId, eventId("dialog"));

  await page.goto("/#reports");
  await page.reload();
  const cta = page.locator(".companion-health .reassessment");
  await expect(cta).toBeVisible();

  // 轮询确实在跑：等第二次 `growth-overview` 请求（每 3 秒一轮）。
  await expect.poll(() => overviewCalls, { timeout: 20000 }).toBeGreaterThan(1);

  const answered = page.waitForResponse((r) =>
    r.url().endsWith(`/reassessment/${event}/response`),
  );
  await cta.getByRole("button", { name: "重新测评", exact: true }).click();
  expect((await answered).status()).toBe(200);
  await expect(cta).toContainText("已确认重新测评");

  const before = overviewCalls;
  await page.getByRole("button", { name: "开始复测", exact: true }).click();
  const dialog = page.locator("#dialog");
  await expect(
    dialog.getByRole("heading", { name: "本次测评用途" }),
  ).toBeVisible();

  // 关键断言：对话框打开期间至少跨过一次轮询周期，而且它还开着。
  await expect
    .poll(() => overviewCalls, { timeout: 20000 })
    .toBeGreaterThan(before);
  expect(
    await page.evaluate(() => document.querySelector("#dialog").open),
  ).toBe(true);
  await expect(
    dialog.getByRole("heading", { name: "本次测评用途" }),
  ).toBeVisible();
  await expect(dialog.locator(".policy-body")).not.toBeEmpty();
  await page.screenshot({
    path: path.join(SHOTS, "p16-dialog-survives-poll-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  await page.setViewportSize(MOBILE);
  await expect(
    dialog.getByRole("heading", { name: "本次测评用途" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(SHOTS, "p16-dialog-survives-poll-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize(DESKTOP);

  // 承接到既有测评流程（不新建第二套入口）。
  await page.getByLabel("我已阅读并同意本次测评用途").check();
  await page.getByRole("button", { name: "同意并开始", exact: true }).click();
  await expect(page.getByText("第 1 / 22 题")).toBeVisible({ timeout: 30000 });
  expect(new URL(page.url()).hash).toContain("assessment/");
  await expect(dialog).not.toBeVisible();
  await page.screenshot({
    path: path.join(SHOTS, "p16-into-assessment.png"),
    fullPage: true,
    animations: "disabled",
  });

  expect(errors).toEqual([]);
});

test("P-17：核验凭据输错时对话框给中文，不显示内部码 PROOF_INVALID", async ({
  page,
}) => {
  test.setTimeout(300000);
  fs.mkdirSync(SHOTS, { recursive: true });

  await login(page);
  const id = await child(page, "核验文案儿童");
  inject(id, "sync_success");
  await bindRobot(page, token("proof"));

  await page.goto("/#settings");
  await page.reload();
  await page.getByRole("button", { name: "核验并关联", exact: true }).click();
  await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
  await page.getByLabel("核验凭据", { exact: true }).fill("INVALID-TEST-PROOF");
  const rejected = page.waitForResponse((r) =>
    r.url().endsWith("/associations/verify"),
  );
  await page.getByRole("button", { name: "确认核验", exact: true }).click();
  expect((await rejected).status()).toBe(422);

  const error = page.locator("#dialog .form-error");
  await expect(error).toContainText("凭据无法核验");
  await expect(error).not.toContainText("PROOF_INVALID");
  expect(await page.content()).not.toContain("PROOF_INVALID");
  await page.screenshot({
    path: path.join(SHOTS, "p17-proof-message.png"),
    fullPage: true,
    animations: "disabled",
  });
});

test("运营端 O-08/O-09/O-10/O-11：姓名列不重复号码、角色与标签给中文、去掉「指纹」", async ({
  page,
}) => {
  test.setTimeout(300000);
  fs.mkdirSync(SHOTS, { recursive: true });

  const stamp = Math.random().toString(16).slice(2, 8);
  const blankPhone = "+8613700" + stamp.slice(0, 5);
  const childName = "T041巡检儿童-" + stamp;
  const username = "ops-t041-" + stamp;
  const password = "ops-t041-pass-1234";
  const activityTitle = "T041英文标签活动-" + stamp;

  const created = shell(`from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from io import StringIO
import uuid
from dingdong_ca.core.models import ActivityContentVersion, Child, DataRequest, Family, FamilyMembership
from dingdong_ca.core.services import ca_account as ca_service
call_command("seed_base", stdout=StringIO())
u = get_user_model().objects.create_user(username=${JSON.stringify(username)}, password=${JSON.stringify(password)}, account_kind="staff", is_staff=True, name="T041 走查管理员")
u.groups.set(Group.objects.filter(name="account_admin"))
parent = get_user_model().objects.create(username="parent-" + uuid.uuid4().hex[:10], account_kind="parent", phone=${JSON.stringify(blankPhone)}, name="", is_staff=False)
parent.set_unusable_password()
parent.save(update_fields=["password"])
family = Family.objects.create()
FamilyMembership.objects.create(family=family, user=parent, role="owner")
kid = Child.objects.create(family=family, created_by=parent, create_request_key=uuid.uuid4(), create_payload={}, name=${JSON.stringify(childName)})
DataRequest.objects.create(child=kid, requester=parent, create_request_key=uuid.uuid4(), kind="support", reason_code="support_needed")
ca_service.issue_account(child=kid, user=parent, request_id=uuid.uuid4(), nfc_token="T041-TOKEN-" + ${JSON.stringify(stamp)}, robot_ref="DD-T041")
ActivityContentVersion.objects.create(code="act-t041-" + ${JSON.stringify(stamp)}, version="v1", title=${JSON.stringify(activityTitle)}, island="imagination", mood="calm", duration_minutes=10, content={"steps": []}, status="draft", data_origin="synthetic")
print("created", kid.pk, family.pk)`);
  expect(created).toContain("created");
  const [childId, familyId] = created
    .split("\n")
    .find((l) => l.startsWith("created"))
    .trim()
    .split(" ")
    .slice(1);

  await page.goto(`${BACKEND}/ops/login/`);
  await page.locator("#id_username").fill(username);
  await page.locator("#id_password").fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(new RegExp("/ops/$"));

  // O-11 + O-08（CA 账户列表）：凭据摘要不再叫「指纹」，绑定家长列不重复手机号。
  await page.goto(
    `${BACKEND}/ops/ca-accounts/?q=${encodeURIComponent(childName)}`,
  );
  const accountRow = page.locator("table tbody tr", { hasText: childName });
  await expect(accountRow).toHaveCount(1);
  await expect(accountRow).toContainText("未填写");
  await expect(accountRow).toContainText("凭据前 8 位");
  expect(await accountRow.innerText()).not.toContain("指纹");
  expect((await accountRow.innerText()).split(blankPhone).length - 1).toBe(1);
  await page.screenshot({
    path: path.join(SHOTS, "ops-o08-o11-ca-accounts.png"),
    fullPage: true,
    animations: "disabled",
  });

  // O-08（服务事项列表）。
  await page.goto(
    `${BACKEND}/ops/services/?q=${encodeURIComponent(childName)}`,
  );
  const serviceRow = page.locator("table tbody tr", { hasText: childName });
  await expect(serviceRow).toHaveCount(1);
  await expect(serviceRow).toContainText("未填写");
  expect((await serviceRow.innerText()).split(blankPhone).length - 1).toBe(1);
  await page.screenshot({
    path: path.join(SHOTS, "ops-o08-services.png"),
    fullPage: true,
    animations: "disabled",
  });

  // O-08（儿童详情）。
  await page.goto(`${BACKEND}/ops/children/${childId}/`);
  const familyCell = page.locator("dd", { hasText: "未填写（" });
  await expect(familyCell).toHaveCount(1);
  expect((await familyCell.innerText()).split(blankPhone).length - 1).toBe(1);
  await page.screenshot({
    path: path.join(SHOTS, "ops-o08-child-detail.png"),
    fullPage: true,
    animations: "disabled",
  });

  // O-09（家庭详情）：角色给中文，不出现内部英文 `owner`。
  await page.goto(`${BACKEND}/ops/families/${familyId}/`);
  const info = page.locator("dl.kv");
  await expect(info).toContainText("主要家长");
  expect(await info.innerText()).not.toContain("owner");
  expect((await info.innerText()).split(blankPhone).length - 1).toBe(1);
  await page.screenshot({
    path: path.join(SHOTS, "ops-o09-family-detail.png"),
    fullPage: true,
    animations: "disabled",
  });

  // O-10（活动列表）：岛屿/情绪给中文，原始值进 title。
  await page.goto(
    `${BACKEND}/ops/activities/?q=${encodeURIComponent(activityTitle)}`,
  );
  const activityRow = page.locator("table tbody tr", {
    hasText: activityTitle,
  });
  await expect(activityRow).toHaveCount(1);
  await expect(activityRow).toContainText("创意想象 · 平静如水");
  await expect(activityRow.locator("[title]").first()).toHaveAttribute(
    "title",
    "imagination · calm",
  );
  await page.screenshot({
    path: path.join(SHOTS, "ops-o10-activities.png"),
    fullPage: true,
    animations: "disabled",
  });

  // 窄屏：改动都在表格与列表里，看一次 390×844 不横向溢出。
  await page.setViewportSize(MOBILE);
  await page.goto(
    `${BACKEND}/ops/ca-accounts/?q=${encodeURIComponent(childName)}`,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: path.join(SHOTS, "ops-o08-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });
});
