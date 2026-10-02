import { test, expect } from "@playwright/test";
import { randomInt } from "node:crypto";
import { GUIDE_MODES } from "../guide-preference.js";

const pageErrors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

test("empty reports prioritize exploration; preference details support keyboard and persisted choices", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const runtime = await (await page.request.get("/api/v1/runtime")).json();
  expect(runtime.sms_mode).toBe("fixed_code");
  await page
    .getByLabel("手机号", { exact: true })
    .fill(`139${String(randomInt(1e8)).padStart(8, "0")}`);
  await page.locator("#send-code").click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByLabel("姓名或称呼").fill("文字焦点合成儿童");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(page.locator(".six-islands")).toBeVisible();

  await page.goto("/#reports");
  const start = page.getByRole("link", { name: "开始一次探索", exact: true });
  await expect(start).toBeVisible();
  const box = await start.boundingBox();
  expect(box.y + box.height).toBeLessThan(760);
  const exportBox = await page
    .locator('#personal-assessments [data-action="export-child"]')
    .boundingBox();
  expect(exportBox.y).toBeGreaterThan(box.y);
  await expect(page.locator(".assessment-start")).not.toHaveAttribute(
    "open",
    "",
  );
  await page.locator(".assessment-start summary").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".assessment-start")).toHaveAttribute("open", "");
  await expect(page.locator(".questionnaire-row")).toHaveCount(2);
  await expect(page.locator(".assessment-start")).toContainText(
    "不评定天赋或能力",
  );
  await start.click();
  await expect(page.locator(".six-islands")).toBeVisible();

  await page.goto("/#companion");
  const options = page.locator(".guide-options");
  await expect(page.locator(".guide-current")).toBeVisible();
  await expect(options).not.toHaveAttribute("open", "");
  await options.locator("summary").focus();
  await page.keyboard.press("Space");
  await expect(options).toHaveAttribute("open", "");
  await expect(options.locator('[data-action="style"]')).toHaveCount(4);
  for (const [mode, value] of Object.entries(GUIDE_MODES)) {
    if (!(await options.evaluate((node) => node.open)))
      await options.locator("summary").click();
    const saved = page.waitForResponse(
      (response) =>
        response.url().includes("/companion-preference") &&
        response.request().method() === "PATCH",
    );
    await options
      .locator(`[data-action="style"][data-value="${mode}"]`)
      .click();
    expect((await saved).ok()).toBe(true);
    await expect(page.locator(".guide-current")).toContainText(value.label);
    await expect(options.locator("summary")).toBeFocused();
    await page.reload();
    await expect(page.locator(".guide-current")).toContainText(value.label);
  }
  await expect(
    page.locator('[data-action="companion-exploration"]'),
  ).toBeVisible();
  await expect(page.locator('[data-action="greeting"]')).toBeVisible();
});
