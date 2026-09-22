/**
 * T-038 的七条文案与展示小项（P-11/P-12/P-13/P-14/P-15 + O-06/O-07）的真实 Chrome 验收。
 *
 * 家长端五条都在「测评与报告」页上，用真实流水线跑出阶段报告（P-14 要卡片上的窗口），
 * 再用 `ca_display_reassess` 注入复测场景（P-11/P-12 要复测区块与人设卡）；观察数据来自
 * `sync_success` 的第一轮同步，展示面注入不动它（两者 fixture 的 subject_key 不同）。
 * 运营端两条用 Django shell 造一个「家长没填姓名」的家庭，再打开真实页面。
 * 不拦截、不伪造任何接口响应。
 *
 * 前置：后端 8017 + Worker/Beat + PostgreSQL/Redis 在跑（同其它 spec）。
 */
import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { root, shell, uvBin } from "./support.js";

const SHOTS = path.join(root, ".trellis", "tasks", "T-038", "shots");
const BACKEND = process.env.OPS_BACKEND_URL || "http://127.0.0.1:8017";

const phone = () =>
  "135" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");

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

async function nav(page, name) {
  await page
    .locator("#main-nav")
    .getByRole("link", { name, exact: true })
    .click();
}

/** 走真实 UI 把机器人绑上（展示面要有一个 `active` 的 CA 账户才取得到数据）。 */
async function bindRobot(page) {
  const mine = `e2e-t038-${Math.random().toString(16).slice(2, 10)}`;
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

/** 走真实 UI 同意同步用途并核验凭据，触发第一轮同步（阶段报告由真实 Worker 生成）。 */
async function grantSync(page, id) {
  await nav(page, "账户与关联");
  await page.getByRole("button", { name: "核验并关联", exact: true }).click();
  await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
  await page.getByLabel("核验凭据", { exact: true }).fill("TEST-PROOF-" + id);
  await page.getByRole("button", { name: "确认核验", exact: true }).click();
  await expect(page.getByText("已核验 · 同步已启用", { exact: true })).toBeVisible();
}

async function openReports(page) {
  await page.goto("/#reports");
  await page.reload();
  await expect(page.locator("#window-form")).toBeVisible();
}

/** 页面上所有像「日期或日期时间」的字符串，用来检查同一页只有一种写法。 */
async function visibleTimes(page) {
  return page.evaluate(() =>
    (document.body.innerText.match(/\d{4}\/\d{1,2}\/\d{1,2}(?: \d{1,2}:\d{2}(?::\d{2})?)?/g) || []),
  );
}

test("家长端五条：P-11 原因标签、P-12 学习风格、P-13 单位、P-14 时间口径、P-15 来源说明", async ({
  page,
}) => {
  test.setTimeout(420000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  fs.mkdirSync(SHOTS, { recursive: true });

  await login(page);
  const id = await child(page, "T038 文案与格式儿童");

  // 真实流水线：绑定 + 同意 + 核验 → Worker 同步 → 阶段画像 → 阶段报告（P-14 的卡片）。
  inject(id, "sync_success");
  await bindRobot(page);
  await grantSync(page, id);
  await nav(page, "测评与报告");
  await expect(
    page.getByRole("button", { name: "查看阶段报告", exact: true }),
  ).toBeVisible({ timeout: 60000 });

  // 复测场景：健康度与复测事件给两个不同的原因（P-11），人设是 persona_science_01（P-12）。
  inject(id, "ca_display_reassess");
  await openReports(page);

  const health = page.locator(".companion-health");
  const cta = page.locator(".companion-health .reassessment");

  // P-11：健康度那句仍是「机器人服务给出的原因」，复测区块改成「这次建议的原因」；
  // 同一个页面里「机器人服务给出的原因」只出现一次（原来出现两次、两个值）。
  await expect(health).toContainText("机器人服务给出的原因：连续多期互动偏少");
  await expect(cta).toContainText("这次建议的原因：近期互动偏少");
  expect(await page.getByText("机器人服务给出的原因", { exact: false }).count()).toBe(1);
  await cta.screenshot({
    path: path.join(SHOTS, "p11-reassessment-reason.png"),
    animations: "disabled",
  });

  // P-12：正文只给中文对照，原始 code 只进 title。
  const persona = page.locator(".companion-persona");
  await expect(persona).toContainText("学习风格：认知");
  const visible = await page.evaluate(() => document.body.innerText);
  for (const code of ["imitation", "open", "reverse", "cognitive"]) {
    expect(visible, `正文不该出现原始 code ${code}`).not.toContain(code);
  }
  await expect(persona.locator('span[title="cognitive"]')).toHaveText("认知");
  await persona.screenshot({
    path: path.join(SHOTS, "p12-persona-learning-style.png"),
    animations: "disabled",
  });

  // P-13：观察单位是中文，界面不再出现 "count"。
  const observation = page.locator("section.panel", {
    hasText: "机器人行为观察",
  });
  await expect(observation).toContainText("观察次数");
  await expect(observation).toContainText("次");
  expect(visible).not.toContain("count");
  await observation.screenshot({
    path: path.join(SHOTS, "p13-observation-unit.png"),
    animations: "disabled",
  });

  // P-15：成长观察区块有来源说明。
  await expect(observation).toContainText("此处为机器人行为观察");
  await observation.locator("p.note").last().screenshot({
    path: path.join(SHOTS, "p15-observation-source.png"),
    animations: "disabled",
  });

  // P-14：同页时间格式统一为「2026/09/01 08:00」（本地时区、零填充、不显示秒）；
  // 阶段报告卡上的窗口与成长观察窗口输入框是同一个时间口径。
  const times = await visibleTimes(page);
  expect(times.length).toBeGreaterThan(0);
  for (const value of times) {
    expect(value, `时间写法不一致：${value}`).toMatch(
      /^\d{4}\/\d{2}\/\d{2}( \d{2}:\d{2})?$/,
    );
  }
  const card = page.locator("article.card", { hasText: "阶段报告" });
  await expect(card).toHaveCount(1);
  const windowText = await card.locator("p").nth(1).innerText();
  const from = await page.locator('#window-form input[name="from"]').inputValue();
  const to = await page.locator('#window-form input[name="to"]').inputValue();
  const same = (value) => value.replace("T", " ").replaceAll("-", "/");
  expect(windowText).toBe(`${same(from)} — ${same(to)}`);
  await card.screenshot({
    path: path.join(SHOTS, "p14-report-window.png"),
    animations: "disabled",
  });

  await page.screenshot({
    path: path.join(SHOTS, "p11-p15-reports-desktop.png"),
    fullPage: true,
    animations: "disabled",
  });

  // 窄屏同页：五条都在，且不横向溢出。
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(persona).toContainText("学习风格：认知");
  await expect(observation).toContainText("此处为机器人行为观察");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(1);
  await page.screenshot({
    path: path.join(SHOTS, "p11-p15-reports-mobile.png"),
    fullPage: true,
    animations: "disabled",
  });

  expect(errors).toEqual([]);
});

test("家长端空态：成长观察还没关联也有来源说明（P-15 边界）", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  fs.mkdirSync(SHOTS, { recursive: true });

  await login(page);
  await child(page, "T038 空态儿童");
  await openReports(page);

  const observation = page.locator("section.panel", { hasText: "尚未关联机器人数据" });
  await expect(observation).toContainText("此处为机器人行为观察");
  // 「不能混成一个分数」的来源纪律说明在「家长支持」页（P-15 边界：空态只保留一句来源说明）。
  await nav(page, "家长支持");
  await expect(page.locator("body")).toContainText("不能直接混成一个分数");
  await page.screenshot({
    path: path.join(SHOTS, "p15-reports-unbound.png"),
    fullPage: true,
    animations: "disabled",
  });

  expect(errors).toEqual([]);
});

test("运营端两条：O-06 家长列不重复手机号、O-07 新增口径标签", async ({
  page,
}) => {
  test.setTimeout(180000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  fs.mkdirSync(SHOTS, { recursive: true });

  const username = `ops-t038-${Date.now().toString(36)}`;
  const password = "pw-" + crypto.randomUUID();
  // 手机号在本库里唯一，每次造一个新的，避免撞 parent_phone_unique。
  const blankPhone = "+86139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  // 儿童称呼也带随机后缀：本地库会留下历次运行的记录，同名会让行定位匹配到多条。
  const childName = `T038 空姓名家长儿童 ${Math.random().toString(16).slice(2, 8)}`;
  const created = shell(
    `import uuid
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from io import StringIO
from dingdong_ca.core.models import Child, Family, FamilyMembership
call_command("seed_base", stdout=StringIO())
u = get_user_model().objects.create_user(username=${JSON.stringify(username)}, password=${JSON.stringify(password)}, account_kind="staff", is_staff=True, name="T038 走查管理员")
u.groups.set(Group.objects.filter(name="account_admin"))
parent = get_user_model().objects.create(username="parent-" + uuid.uuid4().hex[:10], account_kind="parent", phone=${JSON.stringify(blankPhone)}, name="", is_staff=False)
parent.set_unusable_password()
parent.save(update_fields=["password"])
family = Family.objects.create()
FamilyMembership.objects.create(family=family, user=parent, role="owner")
Child.objects.create(family=family, created_by=parent, create_request_key=uuid.uuid4(), create_payload={}, name=${JSON.stringify(childName)})
print("created")`,
  );
  expect(created).toContain("created");

  try {
    await page.goto(`${BACKEND}/ops/login/`);
    await page.locator("#id_username").fill(username);
    await page.locator("#id_password").fill(password);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page).toHaveURL(new RegExp("/ops/$"));

    // O-06：家长列空姓名给「未填写」，号码只在相邻「手机号」列出现一次。
    await page.goto(`${BACKEND}/ops/families/`);
    const row = page.locator("table tbody tr", { hasText: childName });
    await expect(row).toHaveCount(1);
    const cells = row.locator("td");
    await expect(cells.nth(0)).toHaveText("未填写");
    await expect(cells.nth(1)).toHaveText(blankPhone);
    expect(
      await page.locator("table tbody").innerText().then((text) => text.split(blankPhone).length - 1),
    ).toBe(1);
    await page.screenshot({
      path: path.join(SHOTS, "o06-families.png"),
      fullPage: true,
    });

    // O-07：新增口径标签写全，旧标签不再出现。
    await page.goto(`${BACKEND}/ops/`);
    const stat = page.locator(".ops-stat", {
      hasText: "近 7 天新建档案（含已归档）",
    });
    await expect(stat).toHaveCount(1);
    await expect(stat.locator(".ops-stat-note")).toContainText("含已归档");
    await expect(
      page.getByText("近 7 天新增儿童", { exact: true }),
    ).toHaveCount(0);
    await page.screenshot({
      path: path.join(SHOTS, "o07-dashboard.png"),
      fullPage: true,
    });
  } finally {
    shell(
      `from django.contrib.auth import get_user_model
get_user_model().objects.filter(username=${JSON.stringify(username)}).update(is_active=False)`,
    );
  }

  expect(errors).toEqual([]);
});
