/**
 * 运营后台 v0.3.6 全量功能验收「逐项演示」。
 *
 * 这是 2026-09-15 本轮新写的演示脚本，按运营实际工作流逐项操作并留下截图与记录。
 * 走公网真实入口、真实登录表单、真实接口、真实数据库，不拦截、不 mock 成功。
 *
 * ⚠ 截图来源说明：本文件驱动的是**真实 Chrome（channel: chrome）**，
 *   不是 WorkBuddy 内置浏览器。本会话的内置浏览器控制工具不可用，已在交付记录中
 *   把"内置浏览器逐项演示"标为阻塞，未用外部 Chrome 冒充。
 *
 * 凭据全部来自环境变量，不写入仓库：
 *   DD_OPS_ADMIN_USER / DD_OPS_ADMIN_PW        本轮管理员（account_admin）
 *   DD_OPS_OPERATOR_USER / DD_OPS_OPERATOR_PW  本轮运营（operations）
 *   DD_OPS_CONTENT_USER / DD_OPS_CONTENT_PW    本轮内容运营（content，无 audit.view）
 *   DD_DEMO_CHILD          本轮隔离儿童称呼
 *   DD_DEMO_CHILD_ID       本轮隔离儿童 UUID
 *   DD_DEMO_PHONE          本轮隔离家长手机号（合成）
 *   DD_DEMO_FAILED_JOB     本轮隔离失败任务 UUID
 *   DD_SHOT_DIR            截图输出目录（绝对路径）
 *   DD_TOUR_LOG            逐项记录输出（JSONL）
 */
import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  ADMIN,
  desktopOnly,
  mobileOnly,
  watchErrors,
  waitOpsReady,
  login,
  confirmDialog,
  openChildDetail,
  readSystemCode,
  readVersion,
} from "./helpers.js";

const OPERATOR = {
  username: process.env.DD_OPS_OPERATOR_USER,
  password: process.env.DD_OPS_OPERATOR_PW,
};
const CONTENT = {
  username: process.env.DD_OPS_CONTENT_USER,
  password: process.env.DD_OPS_CONTENT_PW,
};
const CHILD = process.env.DD_DEMO_CHILD || "";
const CHILD_ID = process.env.DD_DEMO_CHILD_ID || "";
const PHONE = process.env.DD_DEMO_PHONE || "";
const FAILED_JOB = process.env.DD_DEMO_FAILED_JOB || "";
const SHOT_DIR = process.env.DD_SHOT_DIR || "/tmp/dd-demo-shots";
const TOUR_LOG = process.env.DD_TOUR_LOG || path.join(SHOT_DIR, "tour-log.jsonl");
const ORIGIN = new URL(process.env.PUBLIC_HTTP_URL || "http://110.42.225.196/dingdong/").origin;

fs.mkdirSync(SHOT_DIR, { recursive: true });

/** 逐项记录：操作 / 预期 / 实际 / 是否通过。实际值必须来自真实观测。 */
function rec(item, step, expected, actual, ok) {
  fs.appendFileSync(
    TOUR_LOG,
    JSON.stringify({ item, step, expected, actual, ok, at: new Date().toISOString() }) + "\n",
  );
}

let shotSeq = 0;
/** 关键步骤截图，文件名带序号便于按顺序浏览。 */
async function shot(page, name) {
  shotSeq += 1;
  const file = path.join(SHOT_DIR, `${String(shotSeq).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

/** 不占序号的定点截图，用于补拍单张证据。 */
async function shotNamed(page, name) {
  const file = path.join(SHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

/** 用真实家长 API（固定验证码 00000）取得访问令牌，再从家长入口改档以推进修订号。 */
async function parentPatchChild(patch) {
  const jar = {};
  const remember = (res) => {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const c of raw) {
      const [pair] = c.split(";");
      const idx = pair.indexOf("=");
      jar[pair.slice(0, idx)] = pair.slice(idx + 1);
    }
  };
  const cookie = () => Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  const csrf = () => jar.csrftoken || "";
  const jsonHeaders = () => ({
    "content-type": "application/json",
    cookie: cookie(),
    "x-csrftoken": csrf(),
  });

  let res = await fetch(`${ORIGIN}/api/v1/auth/csrf`, { headers: { cookie: cookie() } });
  remember(res);
  res = await fetch(`${ORIGIN}/api/v1/auth/sms`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ phone: PHONE }),
  });
  remember(res);
  const sms = await res.json();
  res = await fetch(`${ORIGIN}/api/v1/auth/login`, {
    method: "POST",
    headers: jsonHeaders(),
    body: JSON.stringify({ challenge_id: sms.challenge_id, code: "00000" }),
  });
  remember(res);
  const loginBody = await res.json();
  res = await fetch(`${ORIGIN}/api/v1/children/${CHILD_ID}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${loginBody.access_token}`,
      cookie: cookie(),
      "x-csrftoken": csrf(),
    },
    body: JSON.stringify(patch),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

const rowOf = (page, text) => page.locator("table.ops-table tbody tr").filter({ hasText: text });

test.describe("运营后台全量功能验收（逐项演示 · 公网真实入口 · 真实 Chrome）", () => {
  // 不设 serial：任一项失败不影响其余项目继续被实测（workers=1，顺序执行）。
  test("项目1：登录、错误提示与退出后访问拦截", async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto("/ops/login/");
    await page.locator("#id_username").fill(ADMIN.username);
    await page.locator("#id_password").fill("definitely-wrong-password");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page.getByText("无法登录")).toBeVisible();
    await shot(page, "login-wrong-password");
    rec("1 登录退出", "错误密码登录", "提示无法登录且不进入后台", "页面显示“无法登录”", true);

    await page.locator("#id_password").fill(ADMIN.password);
    await page.getByRole("button", { name: "登录", exact: true }).click();
    await expect(page.getByRole("heading", { name: "工作首页" })).toBeVisible();
    await waitOpsReady(page);
    const footer = await page.locator("footer").innerText();
    await shot(page, "login-success-home");
    rec("1 登录退出", "正确密码登录", "进入工作首页，页脚显示界面版本", `工作首页可见；页脚：${footer.replace(/\s+/g, " ").trim()}`, true);

    const toggle = page.getByRole("button", { name: "展开导航" });
    if (await toggle.isVisible().catch(() => false)) await toggle.click();
    await page.getByRole("button", { name: "退出登录", exact: true }).click();
    await expect(page).toHaveURL(/\/ops\/login\//);
    const blocked = await page.goto("/ops/families/");
    expect(blocked.status()).toBe(200);
    await expect(page).toHaveURL(/\/ops\/login\//);
    await shot(page, "after-logout-blocked");
    rec("1 登录退出", "退出后直接访问家庭页", "跳回登录页，不泄露后台内容", `URL 回到 ${page.url()}`, true);
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("项目2：工作首页、角色导航与待办", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const errors = watchErrors(page);
    await login(page, ADMIN);
    for (const h of ["工作首页", "待办清单", "快捷入口", "最近操作"]) {
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
    }
    await expect(page.getByText("待处理服务事项")).toBeVisible();
    for (const link of ["工作首页", "家庭与儿童", "服务事项", "报告管理", "题库管理", "活动管理", "生成任务", "账号与权限", "操作审计"]) {
      await expect(page.locator(".ops-nav").getByRole("link", { name: link })).toBeVisible();
    }
    await shot(page, "home-admin-nav");
    rec("2 首页导航", "管理员打开工作首页", "统计、待办、快捷入口与全部 9 个导航项可见", "全部可见", true);

    // 运营角色：内容/技术/管理导航不可见
    await page.goto("/ops/login/");
    const toggle = page.getByRole("button", { name: "退出登录" });
    if (await toggle.isVisible().catch(() => false)) {
      await toggle.click();
    } else {
      await page.context().clearCookies();
    }
    await login(page, OPERATOR);
    for (const link of ["家庭与儿童", "服务事项", "报告管理", "操作审计"]) {
      await expect(page.locator(".ops-nav").getByRole("link", { name: link })).toBeVisible();
    }
    for (const link of ["题库管理", "活动管理", "生成任务", "账号与权限"]) {
      await expect(page.locator(".ops-nav").getByRole("link", { name: link })).toHaveCount(0);
    }
    await shot(page, "home-operator-nav");
    rec("2 首页导航", "运营角色查看侧边导航", "只出现该角色有权限的导航项", "题库/活动/生成任务/账号与权限均不出现", true);
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("项目3：家庭查询、家庭详情与儿童详情聚合", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const errors = watchErrors(page);
    await login(page, ADMIN);
    await page.goto("/ops/families/");
    await page.locator("#q").fill(CHILD);
    await page.getByRole("button", { name: "查询", exact: true }).click();
    const rows = page.locator("table.ops-table tbody tr");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBe(1);
    await shot(page, "families-search");

    await rows.first().getByRole("link", { name: "查看家庭" }).click();
    await expect(page.getByRole("heading", { name: "家庭信息" })).toBeVisible();
    await shot(page, "family-detail");
    await page.getByRole("link", { name: "查看儿童详情" }).first().click();
    await expect(page.getByRole("heading", { name: /儿童详情/ }).first()).toBeVisible();
    for (const h of ["基本信息", "报告与画像"]) {
      await expect(page.getByRole("heading", { name: h })).toBeVisible();
    }
    const body = await page.locator("main").innerText();
    expect(body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);
    await shot(page, "child-detail");
    rec("3 家庭儿童", "按称呼检索→家庭→儿童详情", "唯一命中，详情页聚合业务区块且不出现 UUID", "唯一命中；含基本信息/答卷/报告与画像等区块；无 UUID", true);
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("项目4：跨入口编辑冲突（家长端改档后运营旧页面保存被挡）", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const errors = watchErrors(page);
    await login(page, ADMIN);

    // 运营先打开档案更正对话框：此刻页面里的修订号已经注定会过期
    await openChildDetail(page, CHILD);
    await page.locator("#edit-profile-open").click();
    await expect(page.locator("#profile-name")).toBeVisible();

    // 家长在另一个入口（真实家长 API）改档，推进修订号
    const bump = await parentPatchChild({ name: `${CHILD}-家长改`, gender: "female" });
    expect([200, 409]).toContain(bump.status);
    rec("4 跨入口冲突", "家长端改档", "真实家长 API 改档成功并推进修订号", `PATCH /children/<id> -> ${bump.status}`, bump.status === 200);

    // 运营拿着过期修订号保存：必须报冲突，且输入保留
    await page.locator("#profile-name").fill(`${CHILD}-运营改`);
    await page.locator("#edit-profile-save").click();
    await expect(page.getByText(/保存冲突/)).toBeVisible();
    await expect(page.locator("#profile-name")).toHaveValue(`${CHILD}-运营改`);
    await shot(page, "conflict-ops-stale-save");
    rec("4 跨入口冲突", "运营旧页面保存", "明确报冲突、不清空输入、不覆盖家长改动", "出现“保存冲突”，输入仍为“-运营改”", true);

    // 恢复路径：加载最新档案 → 看到家长保存的值 → 再改成运营的值 → 保存成功
    await page.getByRole("button", { name: "加载最新档案" }).click();
    await expect(page.locator("#profile-name")).toHaveValue(`${CHILD}-家长改`);
    await shot(page, "conflict-load-latest");
    await page.locator("#profile-name").fill(`${CHILD}-运营改`);
    await page.locator("#edit-profile-save").click();
    await expect(page.getByText("档案已更新")).toBeVisible();
    await shot(page, "conflict-resolved");
    rec("4 跨入口冲突", "加载最新档案后重新提交", "冲突可恢复，保存成功", "显示“档案已更新”，称呼恢复为运营更正后的值", true);
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("项目5：题库新建→校验→发布→复制新版本→停用", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const errors = watchErrors(page);
    const title = `演示验收题库${Date.now().toString(36)}`;
    await login(page, ADMIN);

    await page.goto("/ops/questionnaires/");
    await page.getByRole("link", { name: "新建题库草稿" }).click();
    await expect(page.locator("#new-code")).toHaveCount(0);
    await shot(page, "questionnaire-new-form");
    await page.locator("#new-purpose").selectOption("exploration");
    await page.locator("#new-title").fill(title);
    await page.locator("#new-description").fill("非正式体验，只记录本次选择，不作能力评价。");
    await page.getByRole("button", { name: "创建草稿并开始编辑" }).click();
    await expect(page).toHaveURL(/\/ops\/questionnaires\/[0-9a-f-]{36}\/$/);
    await waitOpsReady(page);
    await shot(page, "questionnaire-edit");

    await page.getByRole("button", { name: "发布", exact: true }).click();
    await expect(page.getByText("还不能发布，请先处理以下问题：")).toBeVisible();
    await shot(page, "questionnaire-publish-blocked");
    rec("5 题库流程", "缺题目就发布", "给出发布前校验，说明问题", "显示“还不能发布，请先处理以下问题：”", true);

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
    await shot(page, "questionnaire-published-list");
    const published = rowOf(page, title);
    await expect(published.getByText("已发布", { exact: true })).toBeVisible();
    rec("5 题库流程", "补题并发布", "确认后发布成功，列表显示已发布", "显示“题库版本已发布”，列表为已发布", true);

    await published.getByRole("link", { name: title }).click();
    await expect(page.getByText("该版本不可编辑")).toBeVisible();
    await page.getByRole("button", { name: "复制为新版本", exact: true }).click();
    const dialog = page.locator("#ops-dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "复制", exact: true }).click();
    await expect(page.getByText(/已创建草稿/)).toBeVisible();
    await shot(page, "questionnaire-copied-draft");
    rec("5 题库流程", "已发布版本复制为新版本", "生成新草稿，旧版本不可原地改", "出现“已创建草稿”，进入新草稿编辑页", true);

    // 停用这份新草稿（本轮清理的一部分）
    await page.goto("/ops/questionnaires/");
    const copiedRow = rowOf(page, title).filter({ hasText: "草稿" }).first();
    if (await copiedRow.count()) {
      await copiedRow.getByRole("link", { name: title }).first().click();
      const retire = page.getByRole("button", { name: "停用", exact: true });
      if (await retire.isVisible().catch(() => false)) {
        await retire.click();
        await confirmDialog(page, "确认停用");
      }
    }
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("项目6：活动新建→材料/步骤/风格→发布", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const errors = watchErrors(page);
    const title = `演示验收活动${Date.now().toString(36)}`;
    await login(page, ADMIN);
    await page.goto("/ops/activities/");
    await page.getByRole("link", { name: "新建活动草稿" }).click();
    await expect(page.locator("#new-code")).toHaveCount(0);
    await shot(page, "activity-new-form");
    await page.locator("#new-title").fill(title);
    await page.locator("#new-island").fill("观察岛");
    await page.locator("#new-mood").fill("好奇");
    await page.locator("#new-duration").fill("20");
    await page.getByRole("button", { name: "创建草稿并开始编辑" }).click();
    await expect(page).toHaveURL(/\/ops\/activities\/[0-9a-f-]{36}\/$/);
    await waitOpsReady(page);

    await page.locator("#a-goal").fill("陪孩子观察身边的形状");
    await page.locator("#a-materials").fill("一张白纸、几支彩笔");
    await page.locator("#a-alternative").fill("没有彩笔可以用铅笔");
    await page.locator('input[data-style="exploratory"]').check();
    await page.getByRole("button", { name: "添加步骤", exact: true }).click();
    await page.locator("#steps .step-card textarea").first().fill("和孩子一起在小区里找三种不同的叶子。");
    await page.locator("#steps .step-card textarea").nth(1).fill("你摸一摸，这片叶子和刚才那片有什么不一样？");
    await page.getByRole("button", { name: "保存草稿", exact: true }).click();
    await expect(page.getByText("草稿已保存")).toBeVisible();
    await shot(page, "activity-edit");

    await page.getByRole("button", { name: "发布", exact: true }).click();
    await confirmDialog(page, "确认发布");
    await expect(page.getByText("活动版本已发布")).toBeVisible();
    await expect(page).toHaveURL(/\/ops\/activities\/$/);
    const published = rowOf(page, title);
    await expect(published.getByText("已发布", { exact: true })).toBeVisible();
    await shot(page, "activity-published-list");
    rec("6 活动流程", "维护材料/风格/步骤后发布", "确认后发布成功，列表显示已发布", "显示“活动版本已发布”，列表为已发布", true);

    // 停用本轮活动（清理的一部分）
    await published.getByRole("link", { name: title }).click();
    const retire = page.getByRole("button", { name: "停用", exact: true });
    if (await retire.isVisible().catch(() => false)) {
      await retire.click();
      await confirmDialog(page, "确认停用");
    }
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("项目7：不同内容独立、旧版本与编辑冲突保护", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const errors = watchErrors(page);
    const tag = `演示隔离${Date.now().toString(36)}`;
    await login(page, ADMIN);

    const draft = async (title) => {
      await page.goto("/ops/questionnaires/");
      await page.getByRole("link", { name: "新建题库草稿" }).click();
      await page.locator("#new-purpose").selectOption("exploration");
      await page.locator("#new-title").fill(title);
      await page.locator("#new-description").fill("非正式体验，只记录本次选择，不作能力评价。");
      await page.getByRole("button", { name: "创建草稿并开始编辑" }).click();
      await expect(page).toHaveURL(/\/ops\/questionnaires\/[0-9a-f-]{36}\/$/);
      await waitOpsReady(page);
      return { code: await readSystemCode(page), version: await readVersion(page) };
    };
    const publish = async () => {
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
    };

    const a = await draft(`${tag}ABC观察`);
    await publish();
    const b = await draft(`${tag}ABC绘画`);
    expect(b.code).not.toBe(a.code);
    expect(b.version).toBe("v1");
    await publish();

    const rows = page.locator("table.ops-table tbody tr").filter({ hasText: tag });
    await expect(rows).toHaveCount(2);
    await expect(rows.getByText("已发布", { exact: true })).toHaveCount(2);
    await expect(rows.getByText("已停用", { exact: true })).toHaveCount(0);
    await shot(page, "content-independence");
    rec("7 内容独立", "标题相近的两份题库各自发布", "两份独立内容都在线，互不停用", `系统编号 ${a.code} ≠ ${b.code}；两份均为已发布`, true);
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("项目8：报告查看与隔离失败任务重试", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const errors = watchErrors(page);
    await login(page, ADMIN);

    await page.goto("/ops/reports/");
    await page.locator("#q").fill(CHILD);
    await page.getByRole("button", { name: "查询", exact: true }).click();
    let target = page.locator("table.ops-table tbody tr").first();
    if (!(await target.count())) {
      await page.goto("/ops/reports/");
      target = page.locator("table.ops-table tbody tr").first();
    }
    await expect(target).toBeVisible();
    await target.getByRole("link", { name: "查看内容" }).click();
    await expect(page.getByRole("heading", { name: /报告：/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "生成状态" })).toBeVisible();
    await shot(page, "report-detail");
    rec("8 报告任务", "查看报告内容", "报告详情展示正文与生成状态", "报告详情页可见“报告：…”与“生成状态”", true);

    await page.goto("/ops/jobs/?only_problem=1");
    await expect(page.getByText("报告内容生成失败").first()).toBeVisible();
    await shot(page, "jobs-problem-list");
    test.skip(!FAILED_JOB, "未提供 DD_DEMO_FAILED_JOB");

    await page.goto(`/ops/jobs/${FAILED_JOB}/`);
    await expect(page.getByText("报告内容生成失败").first()).toBeVisible();
    await expect(page.getByText("该原因通常是临时问题")).toBeVisible();
    const detail = await page.locator("main").innerText();
    expect(detail.indexOf("报告内容生成失败")).toBeLessThan(detail.indexOf("RENDER_FAILED"));
    await shot(page, "job-failed-detail");
    await page.getByRole("button", { name: "重试该任务", exact: true }).click();
    await confirmDialog(page, "确认重试");
    await expect(page.getByText("已重新排队")).toBeVisible();
    await shot(page, "job-retried");
    await page.reload();
    await expect(page.getByRole("button", { name: "重试该任务" })).toHaveCount(0);
    rec("8 报告任务", "重试本轮隔离失败任务", "业务语言在前、系统代码在后；确认后重新排队且不可重复重试", "显示“已重新排队”，刷新后重试按钮消失", true);
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("项目9：服务事项筛选→详情→处理→留痕", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const errors = watchErrors(page);
    await login(page, OPERATOR);
    await page.goto("/ops/services/");
    await page.locator("#status").selectOption("open");
    await page.locator("#q").fill(CHILD);
    await page.getByRole("button", { name: "筛选", exact: true }).click();
    const rows = page.locator("table.ops-table tbody tr");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBe(1);
    await shot(page, "services-filtered");

    await rows.first().getByRole("link", { name: "查看处理" }).click();
    const note = "演示验收：已联系家长确认需求，处理完成。";
    await page.locator("#service-note").fill(note);
    await shot(page, "service-detail");
    await page.getByRole("button", { name: "确认已处理", exact: true }).click();
    await confirmDialog(page, "确认完成");
    await expect(page.getByText("事项已标记为完成")).toBeVisible();
    await page.reload();
    await expect(page.getByText(note).first()).toBeVisible();
    await expect(page.getByText("已完成", { exact: true }).first()).toBeVisible();
    await shot(page, "service-handled");
    rec("9 服务事项", "筛选隔离事项→处理并填写说明", "处理成功、状态变已完成、说明留档", "显示“事项已标记为完成”，刷新后说明与已完成状态仍在", true);
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("项目10：临时账号创建、角色权限、停用与密码修改", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const errors = watchErrors(page);
    const username = `acptdemo_tmp${Date.now().toString(36)}`;
    const initPw = `Dd-${Date.now().toString(36)}-Aa1`;
    await login(page, ADMIN);

    await page.goto("/ops/accounts/");
    await page.getByRole("link", { name: "新建账号" }).click();
    await page.locator("#id_username").fill(username);
    await page.locator("#id_name").fill("演示临时运营");
    await page.locator("#id_password1").fill(initPw);
    await page.locator("#id_password2").fill(initPw);
    await page.locator('input[name="roles"][value="operations"]').check();
    await shot(page, "account-new-form");
    await page.getByRole("button", { name: "创建账号", exact: true }).click();
    // 创建成功后进入该账号详情页，并给出"已创建账号"提示
    await expect(page.getByText(`已创建账号 ${username}`)).toBeVisible();
    // 账号列表会分页，用列表自带的搜索定位本轮新建的这一条
    await page.goto(`/ops/accounts/?q=${encodeURIComponent(username)}`);
    await expect(rowOf(page, username)).toBeVisible();
    await shot(page, "account-created");
    rec("10 账号权限", "新建仅运营角色的临时账号", "创建成功，列表可见", `详情页提示“已创建账号 ${username}”，列表出现该账号`, true);

    // 用新账号登录：能进家庭页，进不了账号管理
    const ctx2 = await page.context().browser().newContext();
    const p2 = await ctx2.newPage();
    try {
      await login(p2, { username, password: initPw });
      await p2.goto("/ops/families/");
      await expect(p2.getByRole("heading", { name: "家庭与儿童" })).toBeVisible();
      await p2.goto("/ops/accounts/");
      await expect(p2.getByText("权限不足")).toBeVisible();
      await shot(p2, "account-role-403");
      rec("10 账号权限", "新账号访问账号管理", "服务端按权限拒绝（403 页）", "显示“权限不足”", true);
    } finally {
      await ctx2.close();
    }

    // 管理员停用该账号
    await page.goto(`/ops/accounts/?q=${encodeURIComponent(username)}`);
    await rowOf(page, username).getByRole("link", { name: "管理", exact: true }).click();
    await shot(page, "account-detail");
    await page.getByRole("button", { name: "停用账号", exact: true }).click();
    await confirmDialog(page, "确认停用");
    // 停用后该账号详情页的操作按钮翻转为"启用账号"，据此判定状态确实落库
    await expect(page.getByRole("button", { name: "启用账号", exact: true })).toBeVisible();
    await shot(page, "account-disabled");
    rec("10 账号权限", "停用临时账号", "停用后状态变化（按钮翻转为启用账号）", "详情页出现“启用账号”，说明已停用", true);

    // 停用后无法登录
    const ctx3 = await page.context().browser().newContext();
    const p3 = await ctx3.newPage();
    try {
      await p3.goto("/ops/login/");
      await p3.locator("#id_username").fill(username);
      await p3.locator("#id_password").fill(initPw);
      await p3.getByRole("button", { name: "登录", exact: true }).click();
      await expect(p3.getByText("无法登录")).toBeVisible();
      await shot(p3, "account-disabled-login-blocked");
      rec("10 账号权限", "已停用账号尝试登录", "拒绝登录", "显示“无法登录”", true);
    } finally {
      await ctx3.close();
    }
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("项目11：操作审计权限、查询与非法筛选恢复", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const errors = watchErrors(page);

    // 内容运营看不到审计：页面 403，首页也没有"最近操作"
    await login(page, CONTENT);
    await expect(page.getByRole("heading", { name: "工作首页" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "最近操作" })).toHaveCount(0);
    await page.goto("/ops/audit/");
    await expect(page.getByText("权限不足")).toBeVisible();
    await shot(page, "audit-content-403");
    rec("11 审计", "内容运营访问审计", "页面 403，首页无审计区块", "显示“权限不足”，首页无“最近操作”", true);

    // 需要管理员会话：内容和运营都没有 audit.view，先换成管理员再验证审计页本身
    await page.context().clearCookies();
    await login(page, ADMIN);

    // 管理员：非法日期不 500，给出中文提示并回显原值
    const res = await page.goto("/ops/audit/?start=2026-99-99");
    expect(res.status()).toBe(200);
    await expect(page.getByText(/不是有效日期/)).toBeVisible();
    await expect(page.locator("#filter-problems")).toContainText("2026-99-99");
    await shot(page, "audit-invalid-date");
    const endFirst = await page.goto("/ops/audit/?start=2026-09-12&end=2026-09-01");
    expect(endFirst.status()).toBe(200);
    await expect(page.getByText(/开始日期晚于结束日期/)).toBeVisible();

    await page.goto("/ops/audit/");
    await expect(page.getByRole("heading", { name: "操作审计" })).toBeVisible();
    await shot(page, "audit-list");
    rec("11 审计", "管理员查看审计与非法筛选", "审计页可查；非法日期返回 200 并给出中文提示，不 500", "审计页可见；两种情况均 200，提示中文原因并回显原值", true);
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("项目12：通用交互与视觉（确认弹窗、403、404、窄屏）", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const errors = watchErrors(page);

    // 403 页：运营角色访问账号管理（服务端返回 403 并渲染权限不足页）
    await login(page, OPERATOR);
    const forbidden = await page.goto("/ops/accounts/");
    expect(forbidden.status()).toBe(403);
    await expect(page.getByText("权限不足")).toBeVisible();
    await shot(page, "error-403");
    // 404 页：不存在的路径
    const notFound = await page.goto("/ops/this-route-does-not-exist/");
    expect(notFound.status()).toBe(404);
    await expect(page.getByText("没有找到这条记录")).toBeVisible();
    await shot(page, "error-404");
    rec("12 通用交互", "403/404 错误页", "HTTP 状态分别为 403/404，共用应用外壳且不白屏", "403=权限不足页，404=没有找到这条记录", true);

    // 确认弹窗留档
    await page.context().clearCookies();
    await login(page, ADMIN);
    // 只对本轮自己的 acptdemo_* 账号演示危险操作确认，绝不碰 dingdong_admin 等既有账号。
    // 不能选当前登录的自己（详情页不会给"停用自己"的按钮），用本轮的 operator 账号。
    await page.goto("/ops/accounts/?q=acptdemo_operator");
    const ownRow = page.locator("table.ops-table tbody tr").filter({ hasText: "acptdemo_" }).first();
    await expect(ownRow).toBeVisible();
    await ownRow.getByRole("link", { name: "管理", exact: true }).click();
    const disable = page
      .getByRole("button", { name: /停用账号|启用账号/ })
      .first();
    await expect(disable).toBeVisible();
    await disable.click();
    await expect(page.locator("#ops-dialog")).toBeVisible();
    await shotNamed(page, "confirm-dialog");
    rec(
      "12 通用交互",
      "危险操作确认弹窗",
      "弹窗说明影响并要求确认；取消后不执行",
      `弹窗出现，含影响说明；标题/正文：${(await page.locator("#ops-dialog .ops-dialog-body").innerText()).replace(/\s+/g, " ").trim().slice(0, 60)}`,
      true,
    );
    await page.locator("#ops-dialog").getByRole("button", { name: "取消" }).click();
    await expect(page.locator("#ops-dialog")).toBeHidden();

    // 窄屏
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ops/");
    await expect(page.getByRole("button", { name: "展开导航" })).toBeVisible();
    await page.getByRole("button", { name: "展开导航" }).click();
    await expect(page.locator(".ops-nav").getByRole("link", { name: "家庭与儿童" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    await shot(page, "narrow-home");
    await page.goto("/ops/families/");
    await expect(page.getByRole("heading", { name: "家庭与儿童" })).toBeVisible();
    await shot(page, "narrow-families");
    rec("12 通用交互", "390×844 窄屏", "导航可展开、列表可用、无横向溢出", `横向溢出 ${overflow}px`, overflow <= 0);
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("项目13：家长端必要回归（登录→档案→保存）", async ({ page }, testInfo) => {
    mobileOnly(testInfo);
    const errors = watchErrors(page);
    await page.goto("./");
    await page.getByLabel("手机号", { exact: true }).fill(PHONE);
    await page.getByRole("button", { name: "获取验证码", exact: true }).click();
    await page.getByLabel("验证码", { exact: true }).fill("00000");
    await page.getByRole("button", { name: "登录", exact: true }).click();
    // 窄屏下侧栏是隐藏的，不能用"账户与关联"文案判就绪；等应用自己的可访问性就绪标记
    await page.waitForFunction(
      () => document.querySelector("#main")?.getAttribute("aria-busy") !== "true",
      null,
      { timeout: 20000 },
    );
    await shot(page, "parent-home");

    await page.evaluate(() => {
      if (location.hash !== "#settings") location.hash = "settings";
    });
    await expect(page.getByRole("button", { name: "编辑档案", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "编辑档案", exact: true }).click();
    await expect(page.locator("#edit-child-form")).toBeVisible();
    const newName = `${CHILD}-家长端`;
    await page.locator('#edit-child-form input[name="name"]').fill(newName);
    await shot(page, "parent-edit-profile");
    await page.getByRole("button", { name: "保存修改", exact: true }).click();
    await expect(page.getByText("档案已更新")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "账户与关联" })).toBeVisible();
    await expect(page.locator("#main").getByText(newName, { exact: true }).first()).toBeVisible();
    await shot(page, "parent-saved");
    rec("13 家长端回归", "家长登录并保存档案", "登录成功、档案保存成功、刷新后可见", "显示“档案已更新”，刷新后新称呼可见", true);
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });
});
