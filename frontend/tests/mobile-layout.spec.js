import { test, expect } from "@playwright/test";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:4173";
const widths = [320, 390, 430];

async function box(locator) {
  const result = await locator.boundingBox();
  expect(result).not.toBeNull();
  return result;
}

async function noHorizontalOverflow(page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

async function createParentAndChild(page) {
  const phone = `139${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  await page.getByLabel("手机号", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
  await page.getByLabel("姓名或称呼").fill("移动布局验收");
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "好奇心，准备出发！" }),
  ).toBeVisible();
}

test("手机登录、主要页面、底部导航与表单的布局保持清楚", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base);
  await expect(page.getByLabel("手机号", { exact: true })).toBeVisible();
  await expect(page.locator("#mobile-nav")).toBeHidden();
  await noHorizontalOverflow(page);

  const code = await box(page.getByLabel("验证码", { exact: true }));
  const send = await box(page.locator("#send-code"));
  const login = await box(
    page.getByRole("button", { name: "登录", exact: true }),
  );
  expect(send.y - (code.y + code.height)).toBeGreaterThanOrEqual(12);
  expect(login.y - (send.y + send.height)).toBeGreaterThanOrEqual(12);

  await createParentAndChild(page);
  for (const width of widths) {
    await page.setViewportSize({
      width,
      height: width === 320 ? 700 : width === 390 ? 844 : 932,
    });
    for (const route of [
      "explore",
      "home",
      "journey",
      "reports",
      "settings",
      "companion",
      "services",
    ]) {
      await page.goto(`${base}/#${route}`);
      await expect(page.locator("#main[aria-busy='false']")).toBeVisible();
      await noHorizontalOverflow(page);
      const nav = await page.locator("#mobile-nav a").evaluateAll((items) =>
        items.map((item) => ({
          label: item.textContent.trim(),
          height: item.getBoundingClientRect().height,
          width: item.getBoundingClientRect().width,
        })),
      );
      expect(nav).toHaveLength(5);
      for (const item of nav) {
        expect(
          item.height,
          `${width}px ${item.label} 导航折行`,
        ).toBeLessThanOrEqual(70);
        expect(
          item.width,
          `${width}px ${item.label} 点击区域太窄`,
        ).toBeGreaterThanOrEqual(48);
      }
      if (route === "reports") {
        const first = await box(page.locator("#main .grid").first());
        const companion = await box(page.locator(".companion-panel"));
        expect(companion.y - (first.y + first.height)).toBeGreaterThanOrEqual(
          16,
        );
        const firstPanel = page.locator("#main .grid .panel").first();
        const copy = await box(firstPanel.locator("p").last());
        const action = await box(firstPanel.locator(".button"));
        expect(action.y - (copy.y + copy.height)).toBeGreaterThanOrEqual(12);
        const empty = await box(page.locator("#main .empty").first());
        const growth = await box(page.locator(".growth-panel"));
        expect(growth.y - (empty.y + empty.height)).toBeGreaterThanOrEqual(16);
        const form = await box(page.locator("#window-form"));
        for (const input of await page.locator("#window-form input").all()) {
          expect((await box(input)).width).toBeGreaterThanOrEqual(
            form.width * 0.9,
          );
        }
        expect(
          (await box(page.locator("#window-form button"))).width,
        ).toBeGreaterThanOrEqual(form.width * 0.9);
        if (width === 320) {
          await page
            .getByRole("button", { name: "开始测评", exact: true })
            .click();
          await expect(page.locator("#dialog")).toBeVisible();
          await page
            .locator("#dialog")
            .getByRole("button", { name: "关闭对话框" })
            .click();
        }
      }
      if (route === "settings") {
        const childActions = page
          .locator(".panel", {
            has: page.getByRole("heading", { name: "儿童档案" }),
          })
          .locator(".actions .button");
        const firstAction = await box(childActions.first());
        const secondAction = await box(childActions.nth(1));
        expect(firstAction.width).toBe(secondAction.width);
        if (width === 320) expect(firstAction.x).toBe(secondAction.x);
        await page
          .getByRole("button", { name: "编辑档案", exact: true })
          .click();
        await expect(page.locator("#dialog")).toBeVisible();
        const dialog = await box(page.locator("#dialog"));
        expect(dialog.x).toBeGreaterThanOrEqual(0);
        expect(dialog.x + dialog.width).toBeLessThanOrEqual(width + 1);
        await page
          .locator("#dialog")
          .getByRole("button", { name: "关闭对话框" })
          .click();
        if (width === 320) {
          await page
            .getByRole("button", { name: "绑定机器人", exact: true })
            .click();
          await expect(page.locator("#dialog")).toBeVisible();
          await page
            .locator("#dialog")
            .getByRole("button", { name: "关闭对话框" })
            .click();
        }
      }
      if (route === "home" && width === 320) {
        await page
          .getByRole("button", { name: "查看活动", exact: true })
          .first()
          .click();
        await expect(page.locator("#dialog")).toBeVisible();
        const activityDialog = await box(page.locator("#dialog"));
        expect(activityDialog.x).toBeGreaterThanOrEqual(0);
        expect(activityDialog.x + activityDialog.width).toBeLessThanOrEqual(
          width + 1,
        );
        await page
          .locator("#dialog")
          .getByRole("button", { name: "关闭对话框" })
          .click();
      }
    }
  }
  for (const width of [768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ["reports", "settings"]) {
      await page.goto(`${base}/#${route}`);
      await expect(page.locator("#main[aria-busy='false']")).toBeVisible();
      await noHorizontalOverflow(page);
    }
  }
  expect(errors).toEqual([]);
});
