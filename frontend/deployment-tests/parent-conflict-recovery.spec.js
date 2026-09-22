/**
 * 家长端「儿童档案保存冲突」恢复流程的真实浏览器验收（v0.3.5 修复 P2）。
 *
 * 背景：v0.3.4 及以前，家长在旧表单上提交、服务端返回 409 后，前端立刻重新读取
 * 最新档案并重建整个表单，家长刚填写的称呼、性别、生日被服务端值替换。数据没有
 * 被覆盖（服务端保护是有效的），但用户这次填写被静默丢弃，也没有让用户选择的机会。
 *
 * 本文件断言的是真实业务目标，不是"没有覆盖数据库"这一件事：
 *   1. 冲突后家长填写的每一个可编辑字段都还在；
 *   2. 服务端仍是对方保存的值，家长这次填写没有被写库；
 *   3. 查看最新资料只是只读对比，不会丢掉本地填写；
 *   4. 只有家长明确确认，才会用最新资料替换表单；取消仍然保留输入；
 *   5. 在最新修订上重新编辑可以正常保存，刷新后能看到结果；
 *   6. 恢复期间对方又改了一次，仍然拒绝覆盖且不丢输入；
 *   7. 读取最新资料失败时输入保留，也不显示保存成功。
 *
 * 真实公网入口、真实登录表单、真实接口、真实数据库。唯一的人为模拟是第 7 项：
 * 用 Playwright 只拦截"读取最新资料"这一个 GET 让它返回 503，用来制造可重复的
 * 读取失败；这是可控测试故障，不代表公网真实故障，其余断言不依赖这次拦截。
 *
 * 凭据全部来自环境变量，不写入仓库：
 *   DD_OPS_ADMIN_USER / DD_OPS_ADMIN_PW   管理员（用于在"另一个入口"更正档案）
 */
import { test, expect } from "@playwright/test";
import {
  ADMIN,
  desktopOnly,
  mobileOnly,
  watchErrors,
  login,
  openChildDetail,
  opsSubmitProfile,
  expectOpsChildName,
  parentSignup,
  openEditProfile,
  fillProfileDraft,
  submitProfile,
  waitChildConflict,
  conflictPanel,
  editName,
  editGender,
  editBirth,
  stamp,
} from "./helpers.js";

/** 家长端：在冲突面板里点一个按钮（面板按钮都在对话框内）。 */
const panelAction = (page, label) =>
  conflictPanel(page).getByRole("button", { name: label, exact: true });

/** 组织一次"家长旧表单提交被判为冲突"的现场：返回儿童称呼。 */
async function setUpConflict(parent, ops, { fields }) {
  const child = `冲突保留${stamp()}`;
  await parentSignup(parent, { name: child, ...fields });
  // 家长打开编辑表单并改字段，先不保存
  await openEditProfile(parent);
  await fillProfileDraft(parent, {
    name: child + "-家长改",
    gender: fields.gender === "male" ? "female" : "male",
    birth_date: "2021-05-06",
  });
  // 运营在另一个入口更正同一份档案的称呼
  await login(ops, ADMIN);
  await openChildDetail(ops, child);
  await opsSubmitProfile(ops, child + "-运营改");
  await expect(ops.getByText("档案已更新")).toBeVisible();
  await expectOpsChildName(ops, child + "-运营改");
  // 家长拿着过期修订号提交
  await submitProfile(parent);
  await waitChildConflict(parent);
  return child;
}

test.describe("家长端档案冲突恢复（真实入口）", () => {
  test("冲突后家长的称呼、性别、生日全部保留，服务端仍是对方保存的值", async ({
    browser,
  }, testInfo) => {
    desktopOnly(testInfo);
    const parentCtx = await browser.newContext();
    const opsCtx = await browser.newContext();
    const parent = await parentCtx.newPage();
    const ops = await opsCtx.newPage();
    const errors = watchErrors(parent, ops);

    try {
      const child = await setUpConflict(parent, ops, {
        fields: { gender: "female", birth_date: "2021-03-04" },
      });

      // 家长这次填写的三个字段必须原样留在输入框里
      await expect(editName(parent)).toHaveValue(child + "-家长改");
      await expect(editGender(parent)).toHaveValue("male");
      await expect(editBirth(parent)).toHaveValue("2021-05-06");

      // 提示要说清"这次没有保存"，并且用家长能理解的话，不提 409 / 修订号 / 数据库
      const panel = conflictPanel(parent);
      await expect(panel).toBeVisible();
      await expect(panel).toContainText("资料已被更新");
      await expect(panel).toContainText("没有保存");
      await expect(panel).not.toContainText("409");
      await expect(panel).not.toContainText("revision");
      await expect(panel).not.toContainText("修订号");

      // 服务端保留运营保存的称呼，家长这次填写没有写库
      await ops.reload();
      await expectOpsChildName(ops, child + "-运营改");
    } finally {
      await parentCtx.close();
      await opsCtx.close();
    }
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("查看最新资料只做对比；取消保留输入；明确确认载入才替换表单，随后可保存成功", async ({
    browser,
  }, testInfo) => {
    desktopOnly(testInfo);
    const parentCtx = await browser.newContext();
    const opsCtx = await browser.newContext();
    const parent = await parentCtx.newPage();
    const ops = await opsCtx.newPage();
    const errors = watchErrors(parent, ops);

    try {
      const child = await setUpConflict(parent, ops, {
        fields: { gender: "female", birth_date: "2021-03-04" },
      });
      const panel = conflictPanel(parent);

      // 查看最新资料：只读对比，表单里的草稿一个字不动
      await panelAction(parent, "查看最新资料").click();
      const diff = panel.locator("table.conflict-diff");
      await expect(diff).toBeVisible();
      await expect(diff).toContainText(child + "-运营改");
      await expect(diff).toContainText(child + "-家长改");
      await expect(editName(parent)).toHaveValue(child + "-家长改");
      await expect(editGender(parent)).toHaveValue("male");
      await expect(editBirth(parent)).toHaveValue("2021-05-06");

      // 载入最新资料是破坏性操作：先要说明影响，取消后输入仍在
      await panelAction(parent, "载入最新资料").click();
      await expect(panel).toContainText("无法找回");
      await panelAction(parent, "取消").click();
      await expect(editName(parent)).toHaveValue(child + "-家长改");
      await expect(editGender(parent)).toHaveValue("male");
      await expect(editBirth(parent)).toHaveValue("2021-05-06");

      // 明确确认后才替换表单
      await panelAction(parent, "载入最新资料").click();
      await panelAction(parent, "确认载入并替换").click();
      await expect(editName(parent)).toHaveValue(child + "-运营改");
      await expect(editBirth(parent)).toHaveValue("2021-03-04");
      await expect(panel).toBeHidden();

      // 在最新修订上重新编辑并保存成功
      await editName(parent).fill(child + "-家长再改");
      await submitProfile(parent);
      await expect(parent.getByText("档案已更新")).toBeVisible();

      // 刷新后能看到结果
      await parent.reload();
      await expect(
        parent.getByRole("heading", { name: "账户与关联" }),
      ).toBeVisible();
      await expect(
        parent
          .locator("#main")
          .getByText(child + "-家长再改", { exact: true })
          .first(),
      ).toBeVisible();
    } finally {
      await parentCtx.close();
      await opsCtx.close();
    }
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("恢复期间对方又改了一次：仍然拒绝覆盖、输入不丢、提示更新", async ({
    browser,
  }, testInfo) => {
    desktopOnly(testInfo);
    const parentCtx = await browser.newContext();
    const opsCtx = await browser.newContext();
    const parent = await parentCtx.newPage();
    const ops = await opsCtx.newPage();
    const errors = watchErrors(parent, ops);

    try {
      const child = await setUpConflict(parent, ops, {
        fields: { gender: "female", birth_date: "2021-03-04" },
      });
      const panel = conflictPanel(parent);

      // 家长先看过最新资料：看到的是运营第一次保存的内容
      await panelAction(parent, "查看最新资料").click();
      await expect(panel.locator("table.conflict-diff")).toContainText(
        child + "-运营改",
      );

      // 在家长确认"用我的修改保存"之前，运营又更正了一次
      await opsSubmitProfile(ops, child + "-运营改2");
      await expect(ops.getByText("档案已更新")).toBeVisible();
      await expectOpsChildName(ops, child + "-运营改2");

      // 家长确认用本地草稿更新：基准仍是家长看到的那一版，服务端已经变了，必须再次拒绝
      await panelAction(parent, "用我的修改保存").click();
      await panelAction(parent, "确认用我的修改保存").click();
      await expect(panel).toContainText("资料又被更新了一次");
      await expect(editName(parent)).toHaveValue(child + "-家长改");
      await expect(editGender(parent)).toHaveValue("male");
      await expect(editBirth(parent)).toHaveValue("2021-05-06");

      // 服务端仍是运营第二次保存的值，没有被家长这次提交覆盖
      await ops.reload();
      await expectOpsChildName(ops, child + "-运营改2");

      // 重新看过最新资料后再确认一次：这次以最新修订为基准，保存成功
      await panelAction(parent, "用我的修改保存").click();
      await expect(panel.locator("table.conflict-diff")).toContainText(
        child + "-运营改2",
      );
      await panelAction(parent, "确认用我的修改保存").click();
      await expect(parent.getByText("档案已更新")).toBeVisible();
    } finally {
      await parentCtx.close();
      await opsCtx.close();
    }
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("读取最新资料失败时：输入保留，不显示保存成功", async ({
    browser,
  }, testInfo) => {
    desktopOnly(testInfo);
    const parentCtx = await browser.newContext();
    const opsCtx = await browser.newContext();
    const parent = await parentCtx.newPage();
    const ops = await opsCtx.newPage();
    const errors = watchErrors(parent, ops);

    try {
      const child = await setUpConflict(parent, ops, {
        fields: { gender: "female", birth_date: "2021-03-04" },
      });
      const panel = conflictPanel(parent);

      // 可控故障：只让"读取最新资料"的 GET 返回 503，模拟读取失败。
      // 这是本用例制造的测试故障，不代表公网真实故障。
      await parent.route("**/api/v1/children/*", (route) =>
        route.request().method() === "GET"
          ? route.fulfill({
              status: 503,
              contentType: "application/json",
              body: JSON.stringify({
                code: "SERVICE_UNAVAILABLE",
                message: "服务暂时不可用",
              }),
            })
          : route.continue(),
      );

      await panelAction(parent, "查看最新资料").click();
      await expect(panel).toContainText("读不到最新资料");
      // 输入保留、没有出现保存成功
      await expect(editName(parent)).toHaveValue(child + "-家长改");
      await expect(editGender(parent)).toHaveValue("male");
      await expect(editBirth(parent)).toHaveValue("2021-05-06");
      await expect(parent.getByText("档案已更新")).toHaveCount(0);

      // 服务端仍是运营保存的值，没有被这次填写影响
      await parent.unroute("**/api/v1/children/*");
      await ops.reload();
      await expectOpsChildName(ops, child + "-运营改");
    } finally {
      await parentCtx.close();
      await opsCtx.close();
    }
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });

  test("窄屏下也能完成冲突恢复并保存", async ({ browser }, testInfo) => {
    mobileOnly(testInfo);
    const parentCtx = await browser.newContext();
    const opsCtx = await browser.newContext();
    const parent = await parentCtx.newPage();
    const ops = await opsCtx.newPage();
    const errors = watchErrors(parent, ops);

    try {
      const child = await setUpConflict(parent, ops, {
        fields: { gender: "female", birth_date: "2021-03-04" },
      });
      const panel = conflictPanel(parent);

      await panelAction(parent, "查看最新资料").click();
      await expect(panel.locator("table.conflict-diff")).toBeVisible();
      await expect(editName(parent)).toHaveValue(child + "-家长改");

      await panelAction(parent, "用我的修改保存").click();
      await panelAction(parent, "确认用我的修改保存").click();
      await expect(parent.getByText("档案已更新")).toBeVisible();
    } finally {
      await parentCtx.close();
      await opsCtx.close();
    }
    expect(errors, `页面脚本错误：${errors.join(" | ")}`).toEqual([]);
  });
});
