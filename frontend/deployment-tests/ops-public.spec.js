/**
 * 运营后台公网真实浏览器验收。
 *
 * 走真实公网入口、真实登录表单与 CSRF、真实数据库，不拦截任何接口响应。
 * 目标入口是 http://110.42.225.196/ops/ —— 后台页面生成的是根绝对路径，
 * 带前缀剥离的 /dingdong/ 入口无法承载（详见 deploy/relay/nginx-location.conf 注释）。
 *
 * 凭据全部来自环境变量，不写入仓库、证据或日志：
 *   DD_OPS_ADMIN_USER / DD_OPS_ADMIN_PW        管理员（account_admin）
 *   DD_OPS_OPERATOR_USER / DD_OPS_OPERATOR_PW  普通运营（operations）
 *   DD_OPS_SEARCH       用于家庭检索的儿童称呼（可选，默认「验收儿童」）
 *   DD_OPS_FAILED_JOB   已存在失败报告的生成任务 UUID（可选）
 */
import { test, expect } from "@playwright/test";

const ADMIN = {
  username: process.env.DD_OPS_ADMIN_USER,
  password: process.env.DD_OPS_ADMIN_PW,
};
const OPERATOR = {
  username: process.env.DD_OPS_OPERATOR_USER,
  password: process.env.DD_OPS_OPERATOR_PW,
};
const SEARCH = process.env.DD_OPS_SEARCH || "验收儿童";
const FAILED_JOB = process.env.DD_OPS_FAILED_JOB || "";

const desktopOnly = (testInfo) =>
  test.skip(testInfo.project.name === "mobile", "写操作只在桌面视口验收");

async function login(page, account) {
  await page.goto("/ops/login/");
  await page.locator("#id_username").fill(account.username);
  await page.locator("#id_password").fill(account.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/ops\/$/);
  // 后台脚本必须真正加载成功，否则页面按钮会静默失效
  expect(await page.evaluate(() => typeof window.Ops)).toBe("object");
}

async function confirmDialog(page, label) {
  const dialog = page.locator("#ops-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: label, exact: true }).click();
}

async function promptDialog(page, label, value) {
  const dialog = page.locator("#ops-dialog");
  await expect(dialog).toBeVisible();
  await dialog.locator("#ops-prompt-input").fill(value);
  await dialog.getByRole("button", { name: label, exact: true }).click();
}

async function logout(page) {
  // 窄屏下侧栏默认移出视口，退出登录在抽屉里，要先展开导航
  const toggle = page.getByRole("button", { name: "展开导航" });
  if (await toggle.isVisible().catch(() => false)) await toggle.click();
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page).toHaveURL(/\/ops\/login\//);
}

test.describe("运营后台（公网）", () => {
  let scriptErrors = [];

  test.beforeEach(async ({ page }) => {
    scriptErrors = [];
    page.on("pageerror", (error) => scriptErrors.push(error.message));
  });

  test.afterEach(() => {
    expect(scriptErrors, `页面脚本错误：${scriptErrors.join(" | ")}`).toEqual([]);
  });

  test("登录失败有提示，成功进入工作首页，退出后无法直接访问", async ({ page }) => {
    await page.goto("/ops/login/");
    await page.locator("#id_username").fill(ADMIN.username);
    await page.locator("#id_password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page.getByText("无法登录")).toBeVisible();

    await page.locator("#id_password").fill(ADMIN.password);
    await page.getByRole("button", { name: "登录", exact: true }).click();

    await expect(page.getByRole("heading", { name: "工作首页" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "待办清单" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "快捷入口" })).toBeVisible();
    await expect(page.getByText("待处理服务事项")).toBeVisible();

    await logout(page);
    await page.goto("/ops/families/");
    await expect(page).toHaveURL(/\/ops\/login\//);
  });

  test("家庭按称呼查询并进入儿童详情，一页聚合真实业务数据", async ({ page }) => {
    await login(page, ADMIN);
    await page.goto("/ops/families/");
    await page.locator("#q").fill(SEARCH);
    await page.getByRole("button", { name: "查询", exact: true }).click();

    const rows = page.locator("table.ops-table tbody tr");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);

    await rows.first().getByRole("link", { name: "查看家庭" }).click();
    await expect(page.getByRole("heading", { name: "家庭信息" })).toBeVisible();

    await page.getByRole("link", { name: "查看儿童详情" }).first().click();
    await expect(page.getByRole("heading", { name: /儿童详情/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "基本信息" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /活动记录/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /答卷/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "报告与画像" })).toBeVisible();

    // 详情页显示的是业务名称，不是 UUID
    const body = await page.locator("main").innerText();
    expect(body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);

    await page.getByRole("link", { name: /返回/ }).first().click();
    await expect(page.getByRole("heading", { name: "家庭信息" })).toBeVisible();
  });

  test("题库：可视化新建草稿→校验→发布→复制新版本", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const title = `公网验收题库 ${Date.now().toString(36)}`;
    await login(page, ADMIN);
    await page.goto("/ops/questionnaires/");
    await page.getByRole("link", { name: "新建题库草稿" }).click();

    await page.locator("#new-code").fill("pub-" + Date.now().toString(36));
    await page.locator("#new-version").fill("v1");
    await page.locator("#new-purpose").selectOption("exploration");
    await page.locator("#new-title").fill(title);
    await page
      .locator("#new-description")
      .fill("非正式体验，只记录本次选择，不作能力评价。");
    await page.getByRole("button", { name: "创建草稿并开始编辑" }).click();

    await expect(page).toHaveURL(/\/ops\/questionnaires\/[0-9a-f-]{36}\/$/);
    await expect(page.locator("#q-title")).toHaveValue(title);

    await page.getByRole("button", { name: "发布", exact: true }).click();
    await expect(page.getByText("还不能发布，请先处理以下问题：")).toBeVisible();

    await page.getByRole("button", { name: "添加题目", exact: true }).click();
    const card = page.locator("#questions .question-card").first();
    await card.locator("textarea").first().fill("遇到没见过的玩具，你更想先做什么？");
    const options = card.locator(".option-row input[type=text]");
    await options.nth(0).fill("先看一看");
    await options.nth(1).fill("直接动手");

    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByText("草稿已保存")).toBeVisible();

    await page.getByRole("button", { name: "发布", exact: true }).click();
    await confirmDialog(page, "确认发布");
    await expect(page.getByText("题库版本已发布")).toBeVisible();

    await expect(page).toHaveURL(/\/ops\/questionnaires\/$/);
    const published = page.locator("table.ops-table tbody tr").filter({ hasText: title });
    await expect(published.getByText("已发布", { exact: true })).toBeVisible();

    await published.getByRole("link", { name: title }).click();
    await expect(page.getByText("该版本不可编辑")).toBeVisible();

    await page.getByRole("button", { name: "复制为新版本", exact: true }).click();
    await promptDialog(page, "复制", "v2");
    await expect(page.getByText("已创建草稿")).toBeVisible();
    await expect(page.locator("#questions .question-card").first()).toBeVisible();
  });

  test("活动：维护材料与步骤后发布", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const title = `公网验收活动 ${Date.now().toString(36)}`;
    await login(page, ADMIN);
    await page.goto("/ops/activities/");
    await page.getByRole("link", { name: "新建活动草稿" }).click();

    await page.locator("#new-code").fill("pub-act-" + Date.now().toString(36));
    await page.locator("#new-version").fill("v1");
    await page.locator("#new-title").fill(title);
    await page.locator("#new-island").fill("观察岛");
    await page.locator("#new-mood").fill("好奇");
    await page.locator("#new-duration").fill("20");
    await page.getByRole("button", { name: "创建草稿并开始编辑" }).click();
    await expect(page).toHaveURL(/\/ops\/activities\/[0-9a-f-]{36}\/$/);
    await expect(page.locator("#a-title")).toHaveValue(title);

    await page.locator("#a-goal").fill("陪孩子观察身边的形状");
    await page.locator("#a-materials").fill("一张白纸、几支彩笔");
    await page.locator("#a-alternative").fill("没有彩笔可以用铅笔");
    // 发布规则要求至少一种可展示风格，不选会被拦下来
    await page.locator('input[data-style="exploratory"]').check();

    await page.getByRole("button", { name: "添加步骤", exact: true }).click();
    await page
      .locator("#steps .step-card textarea")
      .first()
      .fill("和孩子一起在小区里找三种不同的叶子。");
    await page
      .locator("#steps .step-card textarea")
      .nth(1)
      .fill("你摸一摸，这片叶子和刚才那片有什么不一样？");

    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByText("草稿已保存")).toBeVisible();

    await page.getByRole("button", { name: "发布", exact: true }).click();
    await confirmDialog(page, "确认发布");
    await expect(page.getByText("活动版本已发布")).toBeVisible();

    await expect(page).toHaveURL(/\/ops\/activities\/$/);
    const published = page.locator("table.ops-table tbody tr").filter({ hasText: title });
    await expect(published.getByText("已发布", { exact: true })).toBeVisible();
  });

  test("报告：查看已生成内容，失败任务用业务语言说明并可重试", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await login(page, ADMIN);

    await page.goto("/ops/reports/");
    const firstRow = page.locator("table.ops-table tbody tr").first();
    await expect(firstRow).toBeVisible();
    await firstRow.getByRole("link", { name: "查看内容" }).click();
    await expect(page.getByRole("heading", { name: /报告：/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "生成状态" })).toBeVisible();
    await expect(page.getByText("已生成").first()).toBeVisible();
    await expect(page.getByText("内容来源说明")).toBeVisible();

    await page.goto("/ops/jobs/?only_problem=1");
    await expect(page.getByText("报告内容生成失败").first()).toBeVisible();

    test.skip(!FAILED_JOB, "未提供 DD_OPS_FAILED_JOB");
    await page.goto(`/ops/jobs/${FAILED_JOB}/`);
    await expect(page.getByText("报告内容生成失败").first()).toBeVisible();
    await expect(page.getByText("该原因通常是临时问题")).toBeVisible();
    // 业务语言在前，系统代码只是次要参考
    const detail = await page.locator("main").innerText();
    expect(detail.indexOf("报告内容生成失败")).toBeLessThan(detail.indexOf("RENDER_FAILED"));

    await page.getByRole("button", { name: "重试该任务", exact: true }).click();
    await confirmDialog(page, "确认重试");
    await expect(page.getByText("已重新排队")).toBeVisible();

    // 重试确实落到后端：重复点击被拒绝，任务不再处于可重试的失败态
    await page.reload();
    await expect(page.getByRole("button", { name: "重试该任务" })).toHaveCount(0);
  });

  test("服务事项：筛选→详情→处理→历史留痕完整闭环", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    await login(page, OPERATOR);
    await page.goto("/ops/services/");

    // 先按"待处理"筛选，保证拿到的是可处理的事项而不是历史记录
    await page.locator("#status").selectOption("open");
    await page.getByRole("button", { name: "筛选", exact: true }).click();
    await expect(page.getByText("待处理", { exact: true }).first()).toBeVisible();

    const row = page.locator("table.ops-table tbody tr").first();
    await expect(row).toBeVisible();
    await row.getByRole("link", { name: "查看处理" }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const note = "公网验收：已联系家长确认需求，处理完成。";
    await page.locator("#service-note").fill(note);
    await page.getByRole("button", { name: "确认已处理", exact: true }).click();
    await confirmDialog(page, "确认完成");
    await expect(page.getByText("事项已标记为完成")).toBeVisible();

    await page.reload();
    await expect(page.getByText(note).first()).toBeVisible();
    await expect(page.getByText("已完成", { exact: true }).first()).toBeVisible();
  });

  test("越权拦截：普通运营看不到技术页，也不能执行技术动作", async ({ page, request }) => {
    await login(page, OPERATOR);

    await expect(page.locator(".ops-nav").getByRole("link", { name: "生成任务" })).toHaveCount(0);
    await expect(page.locator(".ops-nav").getByRole("link", { name: "账号与权限" })).toHaveCount(0);

    await page.goto("/ops/jobs/");
    await expect(page.getByText("权限不足")).toBeVisible();

    await page.goto("/ops/accounts/");
    await expect(page.getByText("权限不足")).toBeVisible();

    // 直接调用接口也要被服务端拦截，不依赖前端隐藏
    const cookies = await page.context().cookies();
    const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
    const csrf = cookies.find((c) => c.name === "csrftoken");
    const response = await request.post(
      "/api/v1/staff/questionnaires/00000000-0000-0000-0000-000000000000/publish",
      {
        headers: {
          cookie: cookieHeader,
          "X-CSRFToken": csrf ? csrf.value : "",
        },
      },
    );
    expect([403, 404]).toContain(response.status());
  });

  test("窄屏下导航与列表基本可用", async ({ page }) => {
    await login(page, ADMIN);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload();
    await expect(page.getByRole("button", { name: "展开导航" })).toBeVisible();
    await page.getByRole("button", { name: "展开导航" }).click();
    await expect(page.locator(".ops-nav").getByRole("link", { name: "家庭与儿童" })).toBeVisible();
    await page.goto("/ops/families/");
    await expect(page.getByRole("heading", { name: "家庭与儿童" })).toBeVisible();
  });
});
