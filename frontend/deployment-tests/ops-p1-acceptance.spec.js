/**
 * 两个 P1 修复的公网真实浏览器验收。
 *
 * 覆盖第二轮独立验收（v0.3.3）发现的两个 P1：
 *   P1-A 儿童档案修订号只在运营端前进 —— 家长端改档后，运营旧页面仍能静默覆盖
 *   P1-B 不同标题退化成同一内部标识 —— 发布一份会把另一份也停用
 *
 * 真实公网入口、真实登录表单、真实接口、真实数据库；不拦截任何响应。
 * 内部标识（系统编号 code / 版本号）对运营是只读展示，所以身份判定以
 * 运营可见的行为为准：发布一份，另一份是否被连带停用。
 *
 * 凭据全部来自环境变量，不写入仓库：
 *   DD_OPS_ADMIN_USER / DD_OPS_ADMIN_PW    管理员（可编辑题库、活动与儿童档案）
 *
 * 家长端使用隔离的合成账号（随机手机号 + 固定验证码），只创建本轮需要的数据。
 *
 * 注意：本文件只验证"冲突发生"和"服务端数据没被覆盖"。家长端的冲突恢复体验
 * （保留未保存输入、查看最新、明确确认后继续保存）在
 * parent-conflict-recovery.spec.js 里单独验收，不要在这一层用"表单被替换"当成功。
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN,
  stamp,
  desktopOnly,
  watchErrors,
  waitOpsReady,
  login,
  confirmDialog,
  parentSignup,
  openChildDetail,
  opsSubmitProfile,
  openEditProfile,
  fillProfileDraft,
  submitProfile,
  readSystemCode,
  readVersion,
} from "./helpers.js";

/** 家长端：在「账户与关联」页打开编辑档案对话框并提交新称呼。 */
async function parentSubmitProfile(page, name) {
  await openEditProfile(page);
  await fillProfileDraft(page, { name });
  await submitProfile(page);
}

/** 建一个题库草稿，返回 { code, version }；停留在此草稿的编辑页。 */
async function createQuestionnaireDraft(page, title) {
  await page.goto("/ops/questionnaires/");
  await page.getByRole("link", { name: "新建题库草稿" }).click();
  await page.locator("#new-purpose").selectOption("exploration");
  await page.locator("#new-title").fill(title);
  await page
    .locator("#new-description")
    .fill("非正式体验，只记录本次选择，不作能力评价。");
  await page.getByRole("button", { name: "创建草稿并开始编辑" }).click();
  await expect(page).toHaveURL(/\/ops\/questionnaires\/[0-9a-f-]{36}\/$/);
  await waitOpsReady(page);
  await expect(page.locator("#q-title")).toHaveValue(title);
  return { code: await readSystemCode(page), version: await readVersion(page) };
}

/** 在题库编辑页补一道完整题目，让草稿达到可发布状态。 */
async function addOneQuestion(page, prompt) {
  await page.getByRole("button", { name: "添加题目", exact: true }).click();
  const card = page.locator("#questions .question-card").first();
  await card.locator("textarea").first().fill(prompt);
  const options = card.locator(".option-row input[type=text]");
  await options.nth(0).fill("先看一看");
  await options.nth(1).fill("直接动手");
}

/** 补题（可选）→ 保存 → 发布，发布成功后停留在题库列表页。 */
async function publishCurrentQuestionnaire(page, prompt) {
  if (prompt) await addOneQuestion(page, prompt);
  await page.getByRole("button", { name: "保存草稿", exact: true }).click();
  await expect(page.getByText("草稿已保存")).toBeVisible();
  await page.getByRole("button", { name: "发布", exact: true }).click();
  await confirmDialog(page, "确认发布");
  await expect(page.getByText("题库版本已发布")).toBeVisible();
  await expect(page).toHaveURL(/\/ops\/questionnaires\/$/);
}

function questionnaireRow(page, title) {
  return page.locator("table.ops-table tbody tr").filter({ hasText: title });
}

/** 「同题库/同活动的其他版本」卡片里的条目。列表含当前版本本身。 */
function versionHistory(page, heading) {
  return page
    .locator("section.card")
    .filter({ has: page.getByRole("heading", { name: heading }) })
    .locator("ul.timeline li");
}

/** 建一个活动草稿并填到可发布状态，发布后停留在活动列表页。 */
async function createAndPublishActivity(page, title) {
  await page.goto("/ops/activities/");
  await page.getByRole("link", { name: "新建活动草稿" }).click();
  await page.locator("#new-title").fill(title);
  await page.locator("#new-island").fill("观察岛");
  await page.locator("#new-mood").fill("好奇");
  await page.locator("#new-duration").fill("20");
  await page.getByRole("button", { name: "创建草稿并开始编辑" }).click();
  await expect(page).toHaveURL(/\/ops\/activities\/[0-9a-f-]{36}\/$/);
  await waitOpsReady(page);
  await expect(page.locator("#a-title")).toHaveValue(title);
  const code = await readSystemCode(page);
  const version = await readVersion(page);

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
  return { code, version };
}

test.describe("P1 专项验收（公网）", () => {
  let scriptErrors = [];

  test.beforeEach(async ({ page }) => {
    scriptErrors = [];
    page.on("pageerror", (error) => scriptErrors.push(error.message));
  });

  test.afterEach(() => {
    expect(scriptErrors, `页面脚本错误：${scriptErrors.join(" | ")}`).toEqual([]);
  });

  test("P1-A 儿童档案：家长改档后，运营旧页面保存必须报冲突，加载最新后可保存", async ({
    browser,
  }, testInfo) => {
    desktopOnly(testInfo);
    const child = `P1跨入口家长${stamp()}`;
    const parentCtx = await browser.newContext();
    const opsCtx = await browser.newContext();
    const parent = await parentCtx.newPage();
    const ops = await opsCtx.newPage();
    const errors = watchErrors(parent, ops);

    try {
      await parentSignup(parent, { name: child });

      // 运营先渲染档案页：此时页面里记下的修订号已经注定会过期
      await login(ops, ADMIN);
      await openChildDetail(ops, child);

      // 家长在运营还没保存时先改档
      await parentSubmitProfile(parent, child + "-家长改");
      await expect(parent.getByText("档案已更新")).toBeVisible();

      // 运营拿着过期修订号保存：必须明确报冲突，而不是静默覆盖家长的新内容
      await opsSubmitProfile(ops, child + "-运营改");
      await expect(ops.getByText(/保存冲突/)).toBeVisible();
      // 运营本地输入必须保留，不能自动丢弃或自动重试覆盖
      await expect(ops.locator("#profile-name")).toHaveValue(child + "-运营改");

      // 冲突提示里要能一键加载最新档案，加载后看到的是家长的修改
      await ops.getByRole("button", { name: "加载最新档案" }).click();
      await expect(ops.locator("#profile-name")).toHaveValue(child + "-家长改");

      // 在最新内容之上重新应用自己的更正：这次成功，说明冲突可恢复而不是死路
      await ops.locator("#profile-name").fill(child + "-运营改");
      await ops.locator("#edit-profile-save").click();
      await expect(ops.getByText("档案已更新")).toBeVisible();
      await expect(
        ops.getByRole("heading", { name: new RegExp(child + "-运营改") }),
      ).toBeVisible();

      // 家长侧刷新看到运营的更正，家长之前的输入没有被"回写"覆盖
      await parent.reload();
      // 限定在正文里找：页头的儿童下拉里也有同样文字，但那是隐藏的 option
      await expect(
        parent.locator("#main").getByText(child + "-运营改", { exact: true }).first(),
      ).toBeVisible();
    } finally {
      await parentCtx.close();
      await opsCtx.close();
    }
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("P1-A 儿童档案：运营改档后，家长旧页面保存必须报冲突，且服务端保留运营的值", async ({
    browser,
  }, testInfo) => {
    desktopOnly(testInfo);
    const child = `P1跨入口运营${stamp()}`;
    const parentCtx = await browser.newContext();
    const opsCtx = await browser.newContext();
    const parent = await parentCtx.newPage();
    const ops = await opsCtx.newPage();
    const errors = watchErrors(parent, ops);

    try {
      // 家长登录建档，页面内存里的修订号固定在此时
      await parentSignup(parent, { name: child });

      await login(ops, ADMIN);
      await openChildDetail(ops, child);
      await opsSubmitProfile(ops, child + "-运营改");
      await expect(ops.getByText("档案已更新")).toBeVisible();

      // 家长页仍是旧修订号，提交必须被拒绝
      await parentSubmitProfile(parent, child + "-家长改");
      await expect(
        parent.locator("#dialog").getByText(/已被更正过|资料已被更新/).first(),
      ).toBeVisible();
      // 服务端不写入这次提交：运营保存的称呼必须还在。
      // "家长这次填写是否被保留"属于恢复体验，由 parent-conflict-recovery.spec.js
      // 断言；这里断言的只是"没有覆盖数据库"。
      await ops.reload();
      await expect(
        ops.getByRole("heading", { name: new RegExp(child + "-运营改") }),
      ).toBeVisible();
    } finally {
      await parentCtx.close();
      await opsCtx.close();
    }
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("P1-B 题库：标题相近的两份内容各自独立，发布一份不会停用另一份", async ({
    page,
  }, testInfo) => {
    desktopOnly(testInfo);
    const tag = `P1消歧${stamp()}`;
    // 两个标题的中英文部分相同，只差最后两个字；旧实现都会退化成同一个标识
    const titleA = `${tag}ABC观察`;
    const titleB = `${tag}ABC绘画`;
    await login(page, ADMIN);

    const first = await createQuestionnaireDraft(page, titleA);
    // 新建的独立内容只属于自己：版本列表里只有它自己，没有被并进别的题库
    await expect(versionHistory(page, "同题库的其他版本")).toHaveCount(1);
    await publishCurrentQuestionnaire(page, "遇到没见过的玩具，你更想先做什么？");

    const second = await createQuestionnaireDraft(page, titleB);
    expect(second.code).not.toBe(first.code);
    expect(await readVersion(page)).toBe("v1");
    await expect(versionHistory(page, "同题库的其他版本")).toHaveCount(1);
    await publishCurrentQuestionnaire(page, "拿到一张白纸，你第一个想画什么？");

    // 两份都在线：发布 B 没有把 A 连带停用（只在同一本轮用例内断言，不看全表历史数据）
    const rows = page.locator("table.ops-table tbody tr").filter({ hasText: tag });
    await expect(rows).toHaveCount(2);
    await expect(rows.getByText("已发布", { exact: true })).toHaveCount(2);
    await expect(rows.getByText("已停用", { exact: true })).toHaveCount(0);
  });

  test("P1-B 题库：同名两次创建是两份独立内容，不互相停用", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const title = `P1同名${stamp()}`;
    await login(page, ADMIN);

    const first = await createQuestionnaireDraft(page, title);
    await publishCurrentQuestionnaire(page, "今天更想安静地看书，还是出去跑一跑？");

    // 同名再建一份：这是第二份独立题库，不是第一份的新版本
    const second = await createQuestionnaireDraft(page, title);
    expect(second.code).not.toBe(first.code);
    expect(await readVersion(page)).toBe("v1");
    await expect(versionHistory(page, "同题库的其他版本")).toHaveCount(1);
    await publishCurrentQuestionnaire(page, "如果只能带一样东西出门，你会带什么？");

    const rows = questionnaireRow(page, title);
    await expect(rows).toHaveCount(2);
    await expect(rows.getByText("已发布", { exact: true })).toHaveCount(2);
    await expect(rows.getByText("已停用", { exact: true })).toHaveCount(0);
  });

  test("P1-B 题库：复制为新版本并发布后，只替代同一题库的旧版本", async ({ page }, testInfo) => {
    desktopOnly(testInfo);
    const title = `P1版本替代${stamp()}`;
    await login(page, ADMIN);

    const original = await createQuestionnaireDraft(page, title);
    expect(original.version).toBe("v1");
    await publishCurrentQuestionnaire(page, "遇到困难时，你会先找人帮忙还是先自己试？");

    // 复制为新版本：版本号由系统递增，运营不需要填任何技术标识
    await questionnaireRow(page, title).getByRole("link", { name: title }).click();
    await expect(page.getByText("该版本不可编辑")).toBeVisible();
    await page.getByRole("button", { name: "复制为新版本", exact: true }).click();
    const dialog = page.locator("#ops-dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.locator("#ops-prompt-input")).toHaveCount(0);
    await dialog.getByRole("button", { name: "复制", exact: true }).click();
    await expect(page.getByText(/已创建草稿/)).toBeVisible();
    // 复制会跳到新草稿；等版本号真的变成 v2 再读，避免读到旧页面
    await expect.poll(() => readVersion(page), { timeout: 10000 }).toBe("v2");

    // 同一题库：标识不变、版本号前进
    expect(await readSystemCode(page)).toBe(original.code);
    await expect(versionHistory(page, "同题库的其他版本")).toHaveCount(2);

    // 复制件已带原题，不需要再补题
    await publishCurrentQuestionnaire(page, null);

    // 真正版本替代：旧版本自动停用，新版本在线，且只有这两条
    const rows = questionnaireRow(page, title);
    await expect(rows).toHaveCount(2);
    await expect(rows.getByText("已发布", { exact: true })).toHaveCount(1);
    await expect(rows.getByText("已停用", { exact: true })).toHaveCount(1);
  });

  test("P1-B 活动：标题相近的两份内容各自独立，发布一份不会停用另一份", async ({
    page,
  }, testInfo) => {
    desktopOnly(testInfo);
    const tag = `P1消歧活动${stamp()}`;
    const titleA = `${tag}ABC观察`;
    const titleB = `${tag}ABC绘画`;
    await login(page, ADMIN);

    const first = await createAndPublishActivity(page, titleA);
    const second = await createAndPublishActivity(page, titleB);
    expect(second.code).not.toBe(first.code);
    expect(second.version).toBe("v1");

    const rows = page.locator("table.ops-table tbody tr").filter({ hasText: tag });
    await expect(rows).toHaveCount(2);
    await expect(rows.getByText("已发布", { exact: true })).toHaveCount(2);
    await expect(rows.getByText("已停用", { exact: true })).toHaveCount(0);
  });
});
