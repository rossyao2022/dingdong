import { test, expect } from "@playwright/test";

/**
 * 登录页「获取验证码」的输入校验（P-05）。
 *
 * 两件容易做假的事：
 *  1. 手机号为空时前端先拦住，不把请求打出去，提示是中文；
 *  2. 后端 422 的字段说明只留中文，不许把 `ErrorDetail(...)` 的内部 repr 当文案透出来。
 *
 * 截图写到 `frontend/docs/`（该目录不进版本库），任务证据另存 `.trellis/tasks/T-006/shots/`。
 */
const formError = (page) => page.locator("#main .form-error");

test("空手机号点「获取验证码」：中文提示，且不发请求", async ({ page }) => {
  const calls = [];
  page.on("request", (r) => {
    if (r.url().includes("/api/v1/auth/sms")) calls.push(r.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await expect(formError(page)).toHaveText("请先填写手机号，再获取验证码。");
  await expect(formError(page)).not.toContainText("ErrorDetail(");
  expect(calls).toEqual([]);
  await page.screenshot({ path: "docs/t006-blank-phone-desktop.png" });
});

test("空手机号在 390×844 窄屏同样给中文提示", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await expect(formError(page)).toHaveText("请先填写手机号，再获取验证码。");
  await page.screenshot({ path: "docs/t006-blank-phone-mobile.png" });
});

test("格式不合法的手机号：界面提示是中文，不含内部 repr", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill("abc");
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await expect(formError(page)).toContainText("手机号格式不合法");
  await expect(formError(page)).not.toContainText("ErrorDetail(");
  await expect(formError(page)).not.toContainText("[");
  await page.screenshot({ path: "docs/t006-bad-format-desktop.png" });
});

test("填了合法手机号仍能拿到验证码并登录（回归）", async ({ page }) => {
  // 每次换号：后端对同一手机号有 60 秒取码限流，固定号会让第二轮跑成 429。
  const number =
    "139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill(number);
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("验证码已发送");
  await expect(formError(page)).toHaveText("");
  const submit = page.getByRole("button", { name: "登录", exact: true });
  await expect(submit).toBeEnabled();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await submit.click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/t006-login-ok-desktop.png" });
});
