import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  cliDatabaseIdentity,
  cliPolicyVersionId,
  root,
  uvBin,
} from "./support.js";

/**
 * 前置一致性：浏览器那侧（`server.cjs` 代理到 127.0.0.1:8017）与 CLI 侧（`manage.py`）
 * 必须连同一个库。种子生成的记录主键逐库不同，所以两边读同一条已发布用途说明的 id
 * 就能判定同库。不一致时 `inject_fixture` 会报「Child does not exist」——那是本地环境
 * 漂移，不是产品缺陷，这里先失败并把两侧身份说清楚。
 */
test.beforeAll(async ({ request }) => {
  const response = await request.get(
    "/api/v1/policies/current?purpose=assessment_processing",
  );
  if (!response.ok()) {
    throw new Error(
      `本地 e2e 前置不满足：浏览器侧后端（server.cjs 代理 127.0.0.1:8017）读已发布用途说明返回 ${response.status()}。` +
        `先确认后端在跑且已完成 seed（冷启动 seed 会发布用途说明）。`,
    );
  }
  const browserSide = (await response.json()).id;
  const identity = cliDbIdentityOrUnknown();
  let cliSide;
  try {
    cliSide = cliPolicyVersionId();
  } catch (error) {
    throw new Error(
      `本地 e2e 前置不满足：CLI 侧 manage.py 读不到已发布用途说明（CLI 侧库：${identity}）。` +
        `原始错误：${String(error.message).split("\n")[0]}`,
    );
  }
  if (browserSide !== cliSide) {
    throw new Error(
      `本地 e2e 前置不一致：浏览器侧后端的用途说明 id 是 ${browserSide}，CLI 侧 manage.py 读到的是 ${cliSide}` +
        `（CLI 侧库：${identity}）。两边不是同一个库，inject_fixture 会报「Child does not exist」。` +
        `先让后端进程与 CLI 指向同一个 DATABASE_URL 再跑；这是环境漂移，不是产品缺陷。`,
    );
  }
});

/** 读库标识本身失败时不掩盖真正的原因。 */
function cliDbIdentityOrUnknown() {
  try {
    return cliDatabaseIdentity();
  } catch {
    return "（读不到）";
  }
}

const phone = () =>
  "138" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
async function login(page, number = phone()) {
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill(number);
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
  return number;
}
async function child(page, name = "浏览器合成儿童") {
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
  try {
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
  } catch (error) {
    const stderr = String(error.stderr ?? "");
    if (!stderr.includes("Child does not exist")) throw error;
    // 浏览器刚建的儿童在 CLI 侧看不到，只可能是两边连的库不同。
    throw new Error(
      `inject_fixture 在 CLI 侧看不到浏览器刚建的儿童 ${id}（CLI 侧库：${cliDbIdentityOrUnknown()}），` +
        `而浏览器那侧走 server.cjs 代理到 127.0.0.1:8017。两边不是同一个库，属本地环境漂移，不是产品缺陷。` +
        `原始输出：${stderr.trim()}`,
    );
  }
}
async function nav(page, name) {
  await page
    .locator("#main-nav")
    .getByRole("link", { name, exact: true })
    .click();
}

test("真实登录、活动完成、刷新恢复、退出清理", async ({ page }) => {
  await login(page);
  await child(page);
  await nav(page, "今日陪伴");
  await page
    .getByRole("button", { name: "查看活动", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "开始活动", exact: true }).click();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.reload();
  await expect(page.getByText("第 2 / 3 步", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByLabel("活动感受").selectOption("interesting");
  await page.getByLabel("一句话记录").fill("真实浏览器闭环");
  await page.getByRole("button", { name: "完成活动", exact: true }).click();
  await nav(page, "成长旅程");
  await expect(page.getByText("真实浏览器闭环", { exact: true })).toBeVisible();
  const storage = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }));
  expect(JSON.stringify(storage)).not.toMatch(
    /access_token|refresh_token|真实浏览器闭环|浏览器合成儿童/,
  );
  await nav(page, "账户与关联");
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "登录", exact: true }),
  ).toBeVisible();
});

test("用途授权、22题、合成输入、真实初始报告", async ({ page }) => {
  // 22 题逐题保存 + 异步报告流水线（sync → stage_profile → report）实测 75s+；
  // 与 reassessment-cta.spec.js 同一测评流程的做法一致，显式放宽到 10 分钟。
  test.setTimeout(600000);
  await login(page);
  const id = await child(page);
  inject(id, "assessment_success");
  await nav(page, "测评与报告");
  await page.getByRole("button", { name: "开始测评", exact: true }).click();
  await page.getByLabel("我已阅读并同意本次测评用途").check();
  await page.getByRole("button", { name: "同意并开始", exact: true }).click();
  for (let i = 1; i <= 22; i++) {
    await expect(
      page.getByText(new RegExp("第 " + i + " / 22 题")),
    ).toBeVisible();
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
  await page.reload();
  await expect(
    page.getByText("提交五张样例完成本次测评", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "提交样例", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "查看初始报告", exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await page.getByRole("button", { name: "查看初始报告", exact: true }).click();
  await expect(
    page.getByText("专业测评结果: 暂无数据", { exact: true }),
  ).toBeVisible();
});

test("机器人关联、阶段报告、撤回同步授权", async ({ page }) => {
  await login(page);
  const id = await child(page);
  inject(id, "sync_success");
  await nav(page, "账户与关联");
  await page.getByRole("button", { name: "核验并关联", exact: true }).click();
  await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
  await page.getByLabel("核验凭据", { exact: true }).fill("TEST-PROOF-" + id);
  await page.getByRole("button", { name: "确认核验", exact: true }).click();
  await expect(
    page.getByText("已核验 · 同步已启用", { exact: true }),
  ).toBeVisible();
  await nav(page, "测评与报告");
  await expect(
    page.getByRole("button", { name: "查看阶段报告", exact: true }),
  ).toBeVisible({ timeout: 25000 });
  await page.getByRole("button", { name: "查看阶段报告", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "阶段报告", exact: true }),
  ).toBeVisible();
  await nav(page, "账户与关联");
  await page.getByRole("button", { name: "撤回授权", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "撤回授权", exact: true }),
  ).toHaveCount(0);
  await nav(page, "测评与报告");
  await expect(
    page.getByRole("heading", { name: "同步授权已撤回" }),
  ).toBeVisible();
});

test("移动端布局、儿童切换与跨页退出", async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await child(page, "合成儿童甲");
  await page.screenshot({
    path: "docs/mobile-explore.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .locator("#mobile-nav")
    .getByRole("link", { name: "账户与关联", exact: true })
    .click();
  await page.getByRole("button", { name: "添加儿童档案", exact: true }).click();
  const second = await child(page, "合成儿童乙");
  await expect(page.getByLabel("切换儿童")).toHaveValue(second);
  await page.getByLabel("切换儿童").selectOption({ label: "合成儿童甲" });
  await page
    .locator("#mobile-nav")
    .getByRole("link", { name: "成长旅程", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "第一份记录，等你来留下" }),
  ).toBeVisible();
  const other = await context.newPage();
  await other.goto("/#settings");
  await expect(
    other.getByRole("button", { name: "退出登录", exact: true }),
  ).toBeVisible();
  await other.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "登录", exact: true }),
  ).toBeVisible();
});

test("家长提交删除、后台实际处理、无儿童时查看回执", async ({
  page,
  browser,
}) => {
  await login(page);
  await child(page);
  await nav(page, "账户与关联");
  await page
    .getByRole("button", { name: "申请删除儿童数据", exact: true })
    .click();
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith("/data-requests") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "确认提交申请", exact: true }).click();
  const receipt = await (await created).json();
  await expect(
    page.getByText("儿童数据删除 · 待处理", { exact: true }),
  ).toBeVisible();
  const username = "browser-delete-" + crypto.randomUUID();
  const password = crypto.randomUUID();
  const shell = (source) =>
    execFileSync(
      uvBin(),
      [
        "run",
        "--no-sync",
        "--directory",
        path.join(root, "backend"),
        "python",
        "manage.py",
        "shell",
        "-c",
        source,
      ],
      { cwd: root, stdio: "pipe" },
    );
  shell(
    `from django.contrib.auth import get_user_model; from django.contrib.auth.models import Group; u=get_user_model().objects.create_user(username=${JSON.stringify(username)},password=${JSON.stringify(password)},account_kind='staff',is_staff=True); u.groups.add(Group.objects.get(name='technical'))`,
  );
  const staff = await browser.newContext();
  try {
    const admin = await staff.newPage();
    await admin.goto("http://127.0.0.1:8017/admin/login/");
    await admin.locator("#id_username").fill(username);
    await admin.locator("#id_password").fill(password);
    await admin.locator("input[type=submit]").click();
    await expect(admin).toHaveURL("http://127.0.0.1:8017/admin/");
    const cookies = await staff.cookies();
    const result = await staff.request.post(
      "http://127.0.0.1:8017/api/v1/staff/data-requests/" +
        receipt.id +
        "/resolve",
      {
        headers: {
          "X-CSRFToken": cookies.find((c) => c.name === "csrftoken").value,
        },
        data: { action: "execute_deletion", resolution_code: "deleted" },
      },
    );
    expect(result.status()).toBe(200);
    expect((await result.json()).child_id).toBeNull();
    await page.reload();
    await expect(
      page.getByText("儿童数据删除 · 已完成", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/已不保留儿童标识/)).toBeVisible();
    await expect(
      page.getByRole("button", { name: "退出登录", exact: true }),
    ).toBeVisible();
  } finally {
    await staff.close();
    shell(
      `from django.contrib.auth import get_user_model; get_user_model().objects.filter(username=${JSON.stringify(username)}).delete()`,
    );
  }
});

test("登录后首页小岛出发与全部菜单可点击", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await login(page);
  await child(page);
  await page.locator('[data-world-id="science"]').click();
  await expect(page.locator('[data-world-action="depart"]')).toBeEnabled();
  await page.locator('[data-world-action="depart"]').click();
  await expect(
    page.getByRole("heading", { name: "今日陪伴", exact: true }),
  ).toBeVisible();
  for (const [label, title] of [
    ["成长旅程", "成长旅程"],
    ["测评与报告", "测评与报告"],
    ["我的 DingDong", "我的 DingDong"],
    ["账户与关联", "账户与关联"],
    ["家长支持", "家长支持"],
    ["天赋探索", "好奇心，准备出发！"],
  ]) {
    await nav(page, label);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test("探索四题、刷新恢复、返回修改、完成仅展示选择", async ({ page }) => {
  await login(page);
  await child(page, "小禾（体验测试）");
  await nav(page, "测评与报告");
  await page.getByRole("button", { name: "开始探索体验", exact: true }).click();
  await page.getByLabel("我已阅读并同意本次测评用途").check();
  await page.getByRole("button", { name: "同意并开始", exact: true }).click();
  await expect(page.getByText("第 1 / 4 题", { exact: false })).toBeVisible();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "保存并下一题", exact: true }).click();
  await page.reload();
  await expect(page.getByText("第 2 / 4 题", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "上一题", exact: true }).click();
  await expect(page.getByRole("radio").first()).toBeChecked();
  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: "保存并下一题", exact: true }).click();
  for (let i = 2; i <= 4; i++) {
    await expect(
      page.getByText(`第 ${i} / 4 题`, { exact: false }),
    ).toBeVisible();
    await page.getByRole("radio").first().check();
    await page
      .getByRole("button", {
        name: i === 4 ? "保存并完成" : "保存并下一题",
        exact: true,
      })
      .click();
  }
  await page.getByRole("button", { name: "完成探索体验", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "这次，你这样选择" }),
  ).toBeVisible();
  await expect(
    page.getByText("看别人怎么玩一次", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "这次，你这样选择" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/m5-exploration-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/m5-exploration-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});

test("移动端各页面、无效关联提示、资料编辑与帮助回执", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await child(page, "小米（页面测试）");
  for (const [route, title] of [
    ["home", "今日陪伴"],
    ["journey", "成长旅程"],
    ["reports", "测评与报告"],
    ["settings", "账户与关联"],
  ]) {
    await page.goto("/#" + route);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    await page.screenshot({
      path: `docs/m5-mobile-${route}.png`,
      fullPage: true,
      animations: "disabled",
    });
  }
  await page
    .getByRole("link", { name: "家长支持", exact: true })
    .last()
    .click();
  await expect(
    page.getByRole("heading", { name: "家长支持", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "服务与数据处理", exact: true }).click();
  await page.getByRole("link", { name: "伙伴引导", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "我的 DingDong", exact: true }),
  ).toBeVisible();
  await page.goto("/#settings");
  await page.getByRole("button", { name: "编辑档案", exact: true }).click();
  await page.getByLabel("姓名或称呼").fill("小米的新称呼");
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
  // 儿童称呼在「儿童档案」「机器人账户」等处都会出现，这里只断言档案那一格已更新。
  const profilePanel = page.locator("#main section.panel").filter({
    has: page.getByRole("heading", { name: "儿童档案", exact: true }),
  });
  await expect(profilePanel.getByText("小米的新称呼", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "核验并关联", exact: true }).click();
  await page.getByLabel("我已阅读并同意机器人数据同步用途").check();
  await page.getByLabel("核验凭据", { exact: true }).fill("INVALID-TEST-PROOF");
  await page.getByRole("button", { name: "确认核验", exact: true }).click();
  await expect(page.locator("#dialog .form-error")).not.toBeEmpty();
  await page.getByRole("button", { name: "关闭对话框" }).click();
  await page.getByRole("button", { name: "需要帮助", exact: true }).click();
  await page.getByRole("button", { name: "确认提交申请", exact: true }).click();
  await expect(
    page.getByText("帮助事项 · 待处理", { exact: true }),
  ).toBeVisible();
});
