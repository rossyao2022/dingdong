/**
 * 公网/本地真实浏览器验收共用的辅助函数。
 *
 * 真实入口、真实登录表单、真实接口、真实数据库，不拦截任何响应。
 * 凭据全部来自环境变量，不写入仓库：
 *   DD_OPS_ADMIN_USER / DD_OPS_ADMIN_PW   管理员（可编辑题库、活动与儿童档案）
 * 家长端使用隔离的合成账号（随机手机号 + 固定验证码 00000），只创建本轮需要的数据。
 */
import { test, expect } from "@playwright/test";

export const ADMIN = {
  username: process.env.DD_OPS_ADMIN_USER,
  password: process.env.DD_OPS_ADMIN_PW,
};

export const stamp = () => Date.now().toString(36);

/** 写操作只在桌面视口验收：窄屏另有专项用例。 */
export const desktopOnly = (testInfo) =>
  test.skip(testInfo.project.name === "mobile", "写操作只在桌面视口验收");

export const mobileOnly = (testInfo) =>
  test.skip(testInfo.project.name !== "mobile", "窄屏专项用例");

/** 收集页面脚本错误，供用例结束前断言为零。 */
export function watchErrors(...pages) {
  const errors = [];
  pages.forEach((page, index) => {
    page.on("pageerror", (error) =>
      errors.push(`页面${index + 1}: ${error.message}`),
    );
  });
  return errors;
}

export async function waitOpsReady(page) {
  await page.waitForFunction(
    () => document.documentElement.dataset.opsReady === "1",
    null,
    { timeout: 20000 },
  );
  expect(await page.evaluate(() => typeof window.Ops)).toBe("object");
}

export async function login(page, account) {
  await page.goto("/ops/login/");
  await page.locator("#id_username").fill(account.username);
  await page.locator("#id_password").fill(account.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(page).toHaveURL(/\/ops\/$/);
  await waitOpsReady(page);
}

export async function confirmDialog(page, label) {
  const dialog = page.locator("#ops-dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: label, exact: true }).click();
}

/** 运营端：按儿童称呼检索并进入儿童详情页。 */
export async function openChildDetail(page, childName) {
  await page.goto("/ops/families/");
  await page.locator("#q").fill(childName);
  await page.getByRole("button", { name: "查询", exact: true }).click();
  const rows = page.locator("table.ops-table tbody tr");
  await expect(rows.first()).toBeVisible();
  // 隔离数据应当唯一命中，避免误改到既有家庭
  expect(await rows.count()).toBe(1);
  await rows.first().getByRole("link", { name: "查看家庭" }).click();
  await expect(page.getByRole("heading", { name: "家庭信息" })).toBeVisible();
  await page.getByRole("link", { name: "查看儿童详情" }).first().click();
  await expect(
    page.getByRole("heading", { name: /儿童详情/ }).first(),
  ).toBeVisible();
  await waitOpsReady(page);
}

/** 运营端：在儿童详情页提交一次档案更正（不等待结果，由调用方断言）。 */
export async function opsSubmitProfile(page, name) {
  await page.locator("#edit-profile-open").click();
  await expect(page.locator("#profile-name")).toBeVisible();
  await page.locator("#profile-name").fill(name);
  await page.locator("#edit-profile-save").click();
}

/** 运营端保存成功后会自行整页刷新，等刷新完成再看得到新称呼。 */
export async function expectOpsChildName(page, name) {
  await expect(
    page.getByRole("heading", { name: new RegExp(name) }),
  ).toBeVisible();
}

/** 家长端：隔离合成账号登录并建档（固定验证码 00000），返回手机号。 */
export async function parentSignup(page, profile) {
  const phone = "199" + String(Date.now()).slice(-8);
  await page.goto("./");
  await page.getByLabel("手机号", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
  await page.locator('input[name="name"]').fill(profile.name);
  if (profile.gender)
    await page.locator('select[name="gender"]').selectOption(profile.gender);
  if (profile.birth_date)
    await page.locator('input[name="birth_date"]').fill(profile.birth_date);
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "好奇心，准备出发！" }),
  ).toBeVisible();
  return phone;
}

/** 家长端：在「账户与关联」页打开编辑档案对话框。 */
export async function openEditProfile(page) {
  // 只改 hash，不做整页刷新：这样页面仍持有打开表单时读到的修订号
  await page.evaluate(() => {
    if (location.hash !== "#settings") location.hash = "settings";
  });
  await expect(
    page.getByRole("button", { name: "编辑档案", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "编辑档案", exact: true }).click();
  await expect(page.locator("#edit-child-form")).toBeVisible();
}

export const editName = (page) =>
  page.locator('#edit-child-form input[name="name"]');
export const editGender = (page) =>
  page.locator('#edit-child-form select[name="gender"]');
export const editBirth = (page) =>
  page.locator('#edit-child-form input[name="birth_date"]');
export const conflictPanel = (page) => page.locator("#child-conflict");

/** 家长端：在编辑档案对话框里改三个可编辑字段（不提交）。 */
export async function fillProfileDraft(page, profile) {
  if (profile.name !== undefined) await editName(page).fill(profile.name);
  if (profile.gender !== undefined)
    await editGender(page).selectOption(profile.gender);
  if (profile.birth_date !== undefined)
    await editBirth(page).fill(profile.birth_date);
}

export async function submitProfile(page) {
  await page.getByRole("button", { name: "保存修改", exact: true }).click();
}

/**
 * 等到"这次保存被判为冲突"这件事在对话框里出现。
 * 兼容冲突提示的两种形态（面板或旧版提示行），只用于等待，断言由调用方负责。
 */
export async function waitChildConflict(page) {
  await expect(
    page
      .locator("#dialog")
      .getByText(/已被更正过|资料已被更新|资料又被更新/)
      .first(),
  ).toBeVisible();
}

/** 读取页面「题库信息 / 使用情况」里的系统编号（自动生成、只读展示）。 */
export async function readSystemCode(page) {
  const text = await page.evaluate(() => {
    for (const dt of document.querySelectorAll("dl.kv dt")) {
      if (dt.textContent.trim() === "系统编号") {
        return dt.nextElementSibling ? dt.nextElementSibling.textContent : "";
      }
    }
    return "";
  });
  return text.split("（")[0].trim();
}

export async function readVersion(page) {
  return await page.evaluate(() => {
    for (const dt of document.querySelectorAll("dl.kv dt")) {
      if (dt.textContent.trim() === "版本号") {
        return dt.nextElementSibling
          ? dt.nextElementSibling.textContent.trim()
          : "";
      }
    }
    return "";
  });
}
