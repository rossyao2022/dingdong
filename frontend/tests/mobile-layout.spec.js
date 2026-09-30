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

async function noBrokenImages(page) {
  const broken = await page.locator("#main img").evaluateAll(async (images) => {
    // Trigger off-screen lazy assets before verifying every page image.
    images.forEach((image) => {
      image.loading = "eager";
    });
    await Promise.all(
      images.map((image) =>
        Promise.race([
          image.decode().catch(() => {}),
          new Promise((resolve) => setTimeout(resolve, 5000)),
        ]),
      ),
    );
    return images
      .filter((image) => image.naturalWidth === 0)
      .map((image) => image.getAttribute("src"));
  });
  expect(broken).toEqual([]);
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
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/children") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  const childId = (await (await created).json()).id;
  await expect(
    page.getByRole("heading", { name: "发现兴趣，认识独特的你。" }),
  ).toBeVisible();
  return childId;
}

test("登录验证码控件在手机、平板与桌面宽度下对齐且互不遮挡", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 430, 760, 761, 800, 900, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base);
    await expect(page.getByLabel("验证码", { exact: true })).toBeVisible();
    await noHorizontalOverflow(page);
    const code = await box(page.getByLabel("验证码", { exact: true }));
    const send = await box(page.locator("#send-code"));
    const login = await box(
      page.getByRole("button", { name: "登录", exact: true }),
    );
    expect(code.width, `${width}px 验证码输入框太窄`).toBeGreaterThanOrEqual(
      180,
    );
    if (Math.abs(send.y - code.y) < 2) {
      expect(
        Math.abs(send.y + send.height - code.y - code.height),
      ).toBeLessThanOrEqual(2);
    } else {
      expect(
        send.y - code.y - code.height,
        `${width}px 验证码与发码按钮重叠`,
      ).toBeGreaterThanOrEqual(12);
    }
    expect(
      login.y - send.y - send.height,
      `${width}px 发码与登录按钮紧贴`,
    ).toBeGreaterThanOrEqual(12);
  }
});

test("首次建档和无儿童账户页跨屏宽不溢出", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base);
  const phone = `139${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  await page.getByLabel("手机号", { exact: true }).fill(phone);
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
  for (const width of [320, 390, 430, 761, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await noHorizontalOverflow(page);
    const save = await box(
      page.getByRole("button", { name: "保存档案", exact: true }),
    );
    expect(save.x).toBeGreaterThanOrEqual(0);
    expect(save.x + save.width).toBeLessThanOrEqual(width + 1);
    await page.goto(`${base}/#settings`);
    await expect(page.getByRole("heading", { name: "家长账户" })).toBeVisible();
    await noHorizontalOverflow(page);
    await page.goto(`${base}/#explore`);
    await expect(
      page.getByRole("heading", { name: "建立儿童档案" }),
    ).toBeVisible();
  }
});

test("窄屏切换页面回到页首，帮助入口按钮保持一致", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base);
  await createParentAndChild(page);
  await page.goto(`${base}/#settings`);
  await expect(page.locator("#main[aria-busy='false']")).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(200);
  await page.locator("#mobile-nav a[href='#reports']").click();
  const heading = page.getByRole("heading", {
    name: "测评与报告",
    exact: true,
  });
  await expect(heading).toBeInViewport();
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(20);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(200);
  await page.locator("#mobile-nav a[href='#reports']").click();
  await expect(heading).toBeInViewport();

  await page.goto(`${base}/#settings`);
  await expect(page.locator("#main[aria-busy='false']")).toBeVisible();

  const helpButtons = page.locator(".receipts > .actions .button");
  expect(await helpButtons.count()).toBe(3);
  const first = await box(helpButtons.first());
  for (const button of await helpButtons.all()) {
    const current = await box(button);
    expect(current.x).toBe(first.x);
    expect(current.width).toBe(first.width);
  }
});

test("320px 今日陪伴页标题和机器人插画各有空间", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base);
  await createParentAndChild(page);
  await page.goto(`${base}/#home`);
  await expect(page.locator("#main[aria-busy='false']")).toBeVisible();
  const title = await box(page.locator(".hero-panel h2"));
  const art = await box(page.locator(".hero-panel img"));
  expect(title.width).toBeGreaterThanOrEqual(220);
  expect(art.y - (title.y + title.height)).toBeGreaterThanOrEqual(12);
});

test("活动和测评详情在手机、平板、桌面可读可操作", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base);
  await createParentAndChild(page);
  await page.goto(`${base}/#home`);
  await expect(page.locator("#main[aria-busy='false']")).toBeVisible();
  await page
    .getByRole("button", { name: "查看活动", exact: true })
    .first()
    .click();
  await expect(page.locator("#dialog")).toBeVisible();
  const activityDialog = await box(page.locator("#dialog"));
  expect(activityDialog.x).toBeGreaterThanOrEqual(0);
  expect(activityDialog.x + activityDialog.width).toBeLessThanOrEqual(321);
  await page.getByRole("button", { name: "开始活动", exact: true }).click();
  await expect(page.getByText("第 1 / 3 步", { exact: true })).toBeVisible();
  const activityUrl = page.url();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await noHorizontalOverflow(page);
    await noBrokenImages(page);
    await expect(
      page.getByRole("button", { name: "下一步", exact: true }),
    ).toBeInViewport();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByRole("button", { name: "下一步", exact: true }).click();
  await page.getByLabel("活动感受").selectOption("interesting");
  await page.getByLabel("一句话记录").fill("布局巡检完成");
  await page.getByRole("button", { name: "完成活动", exact: true }).click();
  await expect(page.getByText("布局巡检完成", { exact: true })).toBeVisible();
  await page.goto(activityUrl);
  await expect(
    page.getByRole("heading", { name: "活动记录", exact: true }),
  ).toBeVisible();
  await noHorizontalOverflow(page);

  await page.goto(`${base}/#reports`);
  await expect(page.locator("#main[aria-busy='false']")).toBeVisible();
  await page.getByRole("button", { name: "开始测评", exact: true }).click();
  await expect(page.locator("#dialog")).toBeVisible();
  await page.getByLabel("我已阅读并同意本次测评用途").check();
  await page.getByRole("button", { name: "同意并开始", exact: true }).click();
  await expect(page.locator("#answer-form")).toBeVisible();
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await noHorizontalOverflow(page);
    await expect(
      page.locator("#answer-form .answer-option").first(),
    ).toBeInViewport();
  }
  expect(errors).toEqual([]);
});

test("报告详情在多档宽度可读（合成视觉样例）", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(base);
  const childId = await createParentAndChild(page);
  await page.route("**/api/v1/reports/layout-fixture", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "layout-fixture",
        child_id: childId,
        kind: "initial",
        generated_at: "2026-09-29T00:00:00Z",
        sections: [
          {
            title: "观察与建议",
            paragraphs: [
              "和孩子一起观察、尝试，把日常的小发现记录下来。".repeat(8),
            ],
          },
        ],
      }),
    }),
  );
  await page.goto(`${base}/#report/layout-fixture`);
  await expect(
    page.getByRole("heading", { name: "初始报告", exact: true }),
  ).toBeVisible();
  for (const width of [320, 390, 430, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await noHorizontalOverflow(page);
    await expect(page.getByText("观察与建议", { exact: true })).toBeVisible();
    const content = await box(page.locator(".report-section"));
    expect(content.x).toBeGreaterThanOrEqual(0);
    expect(content.x + content.width).toBeLessThanOrEqual(width + 1);
  }
});

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
      await noBrokenImages(page);
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
  for (const width of [761, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 900 });
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
      await noBrokenImages(page);
    }
  }
  expect(errors).toEqual([]);
});
