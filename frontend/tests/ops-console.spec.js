/**
 * 运营后台真实浏览器验收（真实 Chrome，不拦截任何接口响应）。
 *
 * 覆盖：登录/退出、家庭查询、儿童详情、题库草稿→发布、活动维护、
 * 报告查看与异常处理、服务事项处理、越权拦截、窄屏可用性。
 *
 * 前置：后端运行在 http://127.0.0.1:8017（config.settings.local，连接本地合成数据库）。
 */
import { test, expect } from "@playwright/test";
import { shell } from "./support.js";

const BACKEND = process.env.OPS_BACKEND_URL || "http://127.0.0.1:8017";

let seq = 0;
function makeStaff(roles, name = "验收账号") {
  seq += 1;
  const username = `ops-accept-${Date.now().toString(36)}-${seq}-${crypto.randomUUID().slice(0, 6)}`;
  const password = "pw-" + crypto.randomUUID();
  shell(
    `from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core.management import call_command
from io import StringIO
call_command("seed_base", stdout=StringIO())
u = get_user_model().objects.create_user(username=${JSON.stringify(username)}, password=${JSON.stringify(password)}, account_kind="staff", is_staff=True, name=${JSON.stringify(name)})
u.groups.set(Group.objects.filter(name__in=${JSON.stringify(roles)}))`,
  );
  return { username, password };
}

function deactivate(username) {
  shell(
    `from django.contrib.auth import get_user_model
get_user_model().objects.filter(username=${JSON.stringify(username)}).update(is_active=False)`,
  );
}

/**
 * 为界面验收准备一条失败的报告生成任务。
 * 结构与真实流水线产出的阶段报告任务一致（含 profile / association / template），
 * 失败原因本身由 pytest 用例（tests/test_ops_reports.py）通过真实故障注入验证。
 */
function seedFailedReportJob() {
  const key = "ops-browser-accept-" + crypto.randomUUID();
  return shell(
    `from django.apps import apps
from django.utils import timezone
Job = apps.get_model("core", "BackgroundJob")
source = (Job.objects
          .filter(kind="report", status="succeeded",
                  association__synccheckpoint__status="enabled",
                  association__consent_grant__revoked_at__isnull=True)
          .order_by("-created_at").first())
job = Job.objects.create(kind="report", profile=source.profile, association=source.association,
                         template_version=source.template_version,
                         business_key=${JSON.stringify(key)}, status="failed",
                         error_code="RENDER_FAILED", attempt_count=3, max_attempts=5,
                         finished_at=timezone.now())
print(job.pk)`,
  )
    .trim()
    .split("\n")
    .pop()
    .trim();
}

/** 造一条待处理的服务事项，保证界面验收有稳定的输入。 */
function seedServiceRequest() {
  const key = crypto.randomUUID();
  return shell(
    `import uuid
from django.apps import apps
DataRequest = apps.get_model("core", "DataRequest")
Child = apps.get_model("core", "Child")
child = Child.objects.order_by("created_at").first()
row = DataRequest.objects.create(child=child, requester=child.created_by,
                                 create_request_key=uuid.UUID(${JSON.stringify(key)}),
                                 kind="correction", reason_code="correct_profile")
print(row.pk)`,
  )
    .trim()
    .split("\n")
    .pop()
    .trim();
}

async function login(page, { username, password }) {
  await page.goto(`${BACKEND}/ops/login/`);
  await page.locator("#id_username").fill(username);
  await page.locator("#id_password").fill(password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${BACKEND.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/ops/$`));
  // 后台脚本必须真正加载成功，否则页面上的按钮会静默失效
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
  if (value !== undefined) await dialog.locator("#ops-prompt-input").fill(value);
  await dialog.getByRole("button", { name: label, exact: true }).click();
}

test.describe("运营后台", () => {
  let scriptErrors = [];

  test.beforeEach(async ({ page }) => {
    scriptErrors = [];
    page.on("pageerror", (error) => scriptErrors.push(error.message));
  });

  test.afterEach(() => {
    // 页面脚本错误会让按钮静默失效，必须当成失败处理
    expect(scriptErrors, `页面脚本错误：${scriptErrors.join(" | ")}`).toEqual([]);
  });

  test("登录失败有提示，成功进入工作首页，退出后无法直接访问", async ({ page }) => {
    const staff = makeStaff(["account_admin"], "管理员甲");
    try {
      await page.goto(`${BACKEND}/ops/login/`);
      await page.locator("#id_username").fill(staff.username);
      await page.locator("#id_password").fill("definitely-wrong-password");
      await page.getByRole("button", { name: "登录", exact: true }).click();
      await expect(page.getByText("无法登录")).toBeVisible();

      await page.locator("#id_password").fill(staff.password);
      await page.getByRole("button", { name: "登录", exact: true }).click();

      await expect(page.getByRole("heading", { name: "工作首页" })).toBeVisible();
      await expect(page.getByText("待处理服务事项")).toBeVisible();
      await expect(page.getByText("报告生成异常").first()).toBeVisible();
      await expect(page.getByRole("heading", { name: "待办清单" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "快捷入口" })).toBeVisible();

      // 退出后访问受保护页面应回到登录页
      await page.getByRole("button", { name: "退出登录", exact: true }).click();
      await expect(page).toHaveURL(/\/ops\/login\//);
      await page.goto(`${BACKEND}/ops/families/`);
      await expect(page).toHaveURL(/\/ops\/login\//);
    } finally {
      deactivate(staff.username);
    }
  });

  test("家庭查询与儿童详情聚合真实业务数据", async ({ page }) => {
    const staff = makeStaff(["operations"], "运营乙");
    try {
      await login(page, staff);

      await page.goto(`${BACKEND}/ops/families/`);
      await page.locator("#q").fill("合成儿童");
      await page.getByRole("button", { name: "查询", exact: true }).click();
      const rows = page.locator("table.ops-table tbody tr");
      await expect(rows.first()).toBeVisible();
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);

      await rows.first().getByRole("link", { name: "查看家庭" }).click();
      await expect(page.getByRole("heading", { name: "家庭信息" })).toBeVisible();
      await expect(page.getByRole("heading", { name: /儿童档案/ })).toBeVisible();

      await page.getByRole("link", { name: "查看儿童详情" }).first().click();
      await expect(page.getByRole("heading", { name: /儿童详情/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: "基本信息" })).toBeVisible();
      await expect(page.getByRole("heading", { name: /活动记录/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: /答卷/ })).toBeVisible();
      await expect(page.getByRole("heading", { name: "报告与画像" })).toBeVisible();
      await expect(page.getByRole("heading", { name: /伙伴关联与同步/ })).toBeVisible();

      // 返回路径可用
      await page.getByRole("link", { name: /返回/ }).first().click();
      await expect(page.getByRole("heading", { name: "家庭信息" })).toBeVisible();
    } finally {
      deactivate(staff.username);
    }
  });

  test("题库：可视化新建草稿→校验→发布→复制新版本", async ({ page }) => {
    const staff = makeStaff(["content"], "内容丙");
    // 内部编号与版本号由服务端自动生成（v0.3.4 起界面上不再有这两个输入框），
    // 这里用一个可精确定位的标题做创建与清理的依据。
    const title = `验收题库 ${crypto.randomUUID().slice(0, 6)}`;
    try {
      await login(page, staff);
      await page.goto(`${BACKEND}/ops/questionnaires/`);
      await page.getByRole("link", { name: "新建题库草稿" }).click();

      await page.locator("#new-purpose").selectOption("exploration");
      await page.locator("#new-title").fill(title);
      await page.locator("#new-description").fill("非正式体验，只记录本次选择，不作能力评价。");
      await page.getByRole("button", { name: "创建草稿并开始编辑" }).click();

      // 创建后直接进入可视化编辑器
      await expect(page).toHaveURL(/\/ops\/questionnaires\/[0-9a-f-]{36}\/$/);
      await expect(page.locator("#q-title")).toHaveValue(title);

      // 未填题目时发布应被拦截，并给出可读原因
      await page.getByRole("button", { name: "发布", exact: true }).click();
      await expect(page.getByText("还不能发布，请先处理以下问题：")).toBeVisible();
      await expect(page.getByText(/1–10 题/).first()).toBeVisible();

      // 添加一道题，填写题干与两个选项（全程不接触 JSON）
      await page.getByRole("button", { name: "添加题目", exact: true }).click();
      const card = page.locator("#questions .question-card").first();
      await card.locator("textarea").first().fill("遇到一件没见过的小玩意儿，你更想先做什么？");
      const options = card.locator(".option-row input[type=text]");
      await options.nth(0).fill("先看一看");
      await options.nth(1).fill("直接动手");

      // 未保存修改要有可见提示
      await expect(page.locator("[data-dirty-flag]")).toBeVisible();

      await page.getByRole("button", { name: "保存草稿", exact: true }).click();
      await expect(page.getByText("草稿已保存")).toBeVisible();
      await expect(page.locator("[data-dirty-flag]")).toBeHidden();

      await page.getByRole("button", { name: "发布", exact: true }).click();
      await confirmDialog(page, "确认发布");
      await expect(page.getByText("题库版本已发布")).toBeVisible();

      // 发布后回到列表，该版本显示为已发布
      await expect(page).toHaveURL(/\/ops\/questionnaires\/$/);
      const published = page.locator("table.ops-table tbody tr").filter({ hasText: title });
      await expect(published.getByText("已发布", { exact: true })).toBeVisible();

      // 已发布版本不可原地编辑
      await published.getByRole("link", { name: title }).click();
      await expect(page.getByText("该版本不可编辑")).toBeVisible();

      // 复制为新版本，可继续编辑。
      // 编辑页的版本号由系统自动递增，所以这里只需要确认，不再手工填写版本号。
      await page.getByRole("button", { name: "复制为新版本", exact: true }).click();
      await confirmDialog(page, "复制");
      await expect(page.getByText("已创建草稿")).toBeVisible();
      await expect(page).toHaveURL(/\/ops\/questionnaires\/[0-9a-f-]{36}\/$/);
      await expect(page.locator("#q-title")).toHaveValue(title);
      await expect(page.locator("#questions .question-card").first()).toBeVisible();

      // 列表页的“复制为新版本”仍允许指定版本号，走带输入框的对话框
      await page.goto(`${BACKEND}/ops/questionnaires/`);
      const copyRow = page.locator("table.ops-table tbody tr").filter({ hasText: title }).first();
      await copyRow.getByRole("button", { name: "复制为新版本" }).click();
      await promptDialog(page, "复制", "v3");
      await expect(page.getByText("已创建草稿")).toBeVisible();
    } finally {
      shell(
        `from dingdong_ca.core.models import QuestionnaireVersion
QuestionnaireVersion.objects.filter(title=${JSON.stringify(title)}).update(status="retired")`,
      );
      deactivate(staff.username);
    }
  });

  test("活动：维护材料、目标、风格与步骤后发布", async ({ page }) => {
    const staff = makeStaff(["content"], "内容丙");
    const title = `验收活动 ${crypto.randomUUID().slice(0, 6)}`;
    try {
      await login(page, staff);
      await page.goto(`${BACKEND}/ops/activities/`);
      await page.getByRole("link", { name: "新建活动草稿" }).click();

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
    } finally {
      shell(
        `from dingdong_ca.core.models import ActivityContentVersion
ActivityContentVersion.objects.filter(title=${JSON.stringify(title)}).update(status="retired")`,
      );
      deactivate(staff.username);
    }
  });

  test("报告：查看已生成报告内容，并在任务页处理生成异常", async ({ page }) => {
    const operations = makeStaff(["operations"], "运营乙");
    const technical = makeStaff(["technical"], "技术丁");
    const failedJobId = seedFailedReportJob();
    try {
      await login(page, operations);
      await page.goto(`${BACKEND}/ops/reports/`);
      const firstRow = page.locator("table.ops-table tbody tr").first();
      await expect(firstRow).toBeVisible();
      await firstRow.getByRole("link", { name: "查看内容" }).click();
      await expect(page.getByRole("heading", { name: /报告/ })).toBeVisible();

      await page.goto(`${BACKEND}/ops/`);
      await page.getByRole("button", { name: "退出登录", exact: true }).click();
      await expect(page).toHaveURL(/\/ops\/login\//);

      await login(page, technical);
      await page.goto(`${BACKEND}/ops/jobs/?only_problem=1`);
      await expect(page.getByText("报告内容生成失败").first()).toBeVisible();

      // 直接进入该失败任务，核对失败原因用业务语言表达
      await page.goto(`${BACKEND}/ops/jobs/${failedJobId}/`);
      await expect(page.getByText("报告内容生成失败").first()).toBeVisible();
      await expect(page.getByText("该原因通常是临时问题")).toBeVisible();
      await expect(page.getByText(/系统代码 RENDER_FAILED/)).toBeVisible();

      await page.getByRole("button", { name: "重试该任务", exact: true }).click();
      await confirmDialog(page, "确认重试");
      await expect(page.getByText("已重新排队")).toBeVisible();

      // 刷新后任务不再是失败状态，说明重试真的生效了。
      // 只断言"不再是失败"：Worker 在线时可能立刻把任务消费掉，
      // 写成固定的"排队中"会变成看 Worker 手速的偶发失败。
      await page.reload();
      await expect(page.locator("dl.kv .badge").first()).not.toHaveText("失败");
      await expect(page.getByRole("button", { name: "重试该任务" })).toHaveCount(0);
    } finally {
      deactivate(operations.username);
      deactivate(technical.username);
    }
  });

  test("服务事项：查看诉求并完成处理，历史与说明留痕", async ({ page }) => {
    const staff = makeStaff(["operations"], "运营乙");
    const requestId = seedServiceRequest();
    try {
      await login(page, staff);
      await page.goto(`${BACKEND}/ops/services/`);
      await expect(page.getByText("待处理", { exact: true }).first()).toBeVisible();

      const row = page.locator("table.ops-table tbody tr").filter({ hasText: /家长求助|资料更正申请/ }).first();
      await row.getByRole("link", { name: "查看处理" }).click();
      await expect(page.getByRole("heading", { name: /家长求助|资料更正申请/ })).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${requestId}/$`));

      await page.locator("#service-note").fill("已电话联系家长确认需求，处理完成。");
      await page.getByRole("button", { name: "确认已处理", exact: true }).click();
      await confirmDialog(page, "确认完成");
      await expect(page.getByText("事项已标记为完成")).toBeVisible();

      await page.reload();
      await expect(page.getByText("已电话联系家长确认需求，处理完成。").first()).toBeVisible();
      await expect(page.getByText("已完成", { exact: true }).first()).toBeVisible();
    } finally {
      deactivate(staff.username);
    }
  });

  test("越权拦截：运营角色看不到技术页，也不能执行技术动作", async ({ page, request }) => {
    const staff = makeStaff(["operations"], "受限运营");
    try {
      await login(page, staff);

      // 导航里没有技术与管理分组
      await expect(page.locator(".ops-nav").getByRole("link", { name: "生成任务" })).toHaveCount(0);
      await expect(page.locator(".ops-nav").getByRole("link", { name: "账号与权限" })).toHaveCount(0);

      await page.goto(`${BACKEND}/ops/jobs/`);
      await expect(page.getByText("权限不足")).toBeVisible();

      await page.goto(`${BACKEND}/ops/accounts/`);
      await expect(page.getByText("权限不足")).toBeVisible();

      await page.goto(`${BACKEND}/ops/questionnaires/`);
      await expect(page.getByText("权限不足")).toBeVisible();

      // 直接调用接口也要被拦截（服务端校验，不依赖前端隐藏）
      const cookies = await page.context().cookies();
      const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      const publish = await request.post(
        `${BACKEND}/api/v1/staff/questionnaires/00000000-0000-0000-0000-000000000000/publish`,
        { headers: { cookie: cookieHeader, "X-CSRFToken": csrfFrom(cookies) } },
      );
      expect([403, 404]).toContain(publish.status());
    } finally {
      deactivate(staff.username);
    }
  });

  test("窄屏下导航与表单基本可用", async ({ page }) => {
    const staff = makeStaff(["operations"], "运营乙");
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await login(page, staff);
      await expect(page.getByRole("button", { name: "展开导航" })).toBeVisible();
      await page.getByRole("button", { name: "展开导航" }).click();
      await expect(page.locator(".ops-nav").getByRole("link", { name: "家庭与儿童" })).toBeVisible();
      await page.goto(`${BACKEND}/ops/families/`);
      await expect(page.getByRole("heading", { name: "家庭与儿童" })).toBeVisible();
    } finally {
      deactivate(staff.username);
    }
  });
});

function csrfFrom(cookies) {
  const token = cookies.find((c) => c.name === "csrftoken");
  return token ? token.value : "";
}
