import { test, expect } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * 慢网下提交的进行中提示（P-07）。
 *
 * 复现方式：CDP `Network.emulateNetworkConditions` 把延迟拉到 4000ms。
 * 改前实测：点「登录」后按钮只是变灰，文案仍是「登录」，家长会以为点空了反复点。
 * 改后要求：按钮进入可见进行中态（文案「登录中…」+ `aria-busy` + 转圈）。
 *
 * 证据截图写到任务目录（`frontend/docs/` 不进版本库，验收证据要能随任务归档）。
 */
const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, "..", "..", ".trellis", "tasks", "T-010", "shots");
mkdirSync(shots, { recursive: true });

const SLOW = {
  offline: false,
  latency: 4000,
  downloadThroughput: -1,
  uploadThroughput: -1,
};
const FAST = {
  offline: false,
  latency: 0,
  downloadThroughput: -1,
  uploadThroughput: -1,
};

const phone = () =>
  "139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");

test("4 秒延迟下点「登录」：按钮给出可见进行中态，慢网结束后照常登录", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill(phone());
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("验证码已发送");
  await page.getByLabel("验证码", { exact: true }).fill("00000");

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", SLOW);
  try {
    const submit = page.locator("#login-form button[type=submit]");
    await expect(submit).toHaveText("登录");
    await submit.click();
    await expect(submit).toHaveText("登录中…");
    await expect(submit).toHaveAttribute("aria-busy", "true");
    await expect(submit).toBeDisabled();
    await page.screenshot({ path: join(shots, "t010-login-busy-desktop.png") });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: join(shots, "t010-login-busy-mobile.png") });

    await expect(
      page.getByRole("heading", { name: "建立儿童档案" }),
    ).toBeVisible({ timeout: 30000 });
    await expect(page.locator("#login-form")).toHaveCount(0);
  } finally {
    await cdp.send("Network.emulateNetworkConditions", FAST);
  }
});

test("登录失败时按钮回到「登录」原样，可再次提交", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill(phone());
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await expect(page.locator("#toast")).toContainText("验证码已发送");
  await page.getByLabel("验证码", { exact: true }).fill("11111");

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", SLOW);
  try {
    const submit = page.locator("#login-form button[type=submit]");
    await submit.click();
    await expect(submit).toHaveText("登录中…");
    await expect(page.locator("#main .form-error")).toContainText("验证码");
    await expect(submit).toHaveText("登录");
    await expect(submit).not.toHaveAttribute("aria-busy", "true");
    await expect(submit).toBeEnabled();
    await page.screenshot({ path: join(shots, "t010-login-restored-desktop.png") });
  } finally {
    await cdp.send("Network.emulateNetworkConditions", FAST);
  }
});
