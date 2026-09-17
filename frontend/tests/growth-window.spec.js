import { test, expect } from "@playwright/test";

/**
 * 「成长观察」时间窗口的就地校验（P-06）。
 *
 * 覆盖两件容易做假的事：
 *  1. 起 ≥ 止 时不发请求，但必须就地给出中文提示、两个输入框进入可见错误态；
 *  2. 改回合法区间后错误态消失，查询照常发出。
 *
 * 截图写到 `frontend/docs/`（该目录不进版本库），任务证据另存 `.trellis/tasks/T-009/shots/`。
 */
const phone = () =>
  "139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");

async function login(page) {
  await page.goto("/");
  await page.getByLabel("手机号", { exact: true }).fill(phone());
  await page.getByRole("button", { name: "获取验证码", exact: true }).click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
}

async function createChild(page, name) {
  await page.getByLabel("姓名或称呼").fill(name);
  const created = page.waitForResponse(
    (r) =>
      r.url().endsWith("/api/v1/children") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await created;
  await expect(page.locator("#main")).toHaveAttribute("aria-busy", "false");
}

/** 从侧边导航进入「测评与报告」，成长观察的时间窗口在这里。 */
async function openReports(page) {
  // 上一笔提交的 act() 还没收尾时点导航会被 busy 守卫拦掉，这里等它松开再点。
  const link = page.locator('#main-nav a[href="#reports"]');
  for (let i = 0; i < 5; i++) {
    await link.click();
    if (await page.locator("#window-form").count()) break;
    await page.waitForTimeout(500);
  }
  await expect(page.locator("#window-form")).toBeVisible();
}

const field = (page, name) =>
  page.locator(`#window-form input[name="${name}"]`);
const hint = (page) => page.locator("#window-form .form-error");
const paint = (locator) =>
  locator.evaluate((el) => {
    const s = getComputedStyle(el);
    return { border: s.borderColor, background: s.backgroundColor };
  });

test("起 ≥ 止：就地提示 + 两个输入框标红，且不发请求", async ({ page }) => {
  const calls = [];
  page.on("request", (r) => {
    if (r.url().includes("growth-overview")) calls.push(r.url());
  });
  await login(page);
  await createChild(page, "时间窗口合成儿童");
  await openReports(page);
  const idle = await paint(field(page, "from"));
  // 进页面本身会拉一次观察数据；这里只关心非法提交有没有多打请求。
  const loaded = calls.length;

  await field(page, "from").fill("2026-09-17T10:00");
  await field(page, "to").fill("2026-09-17T09:00");
  await page.getByRole("button", { name: "查看这个窗口" }).click();

  await expect(hint(page)).toBeVisible();
  await expect(hint(page)).toHaveText("结束时间要晚于开始时间");
  await expect(field(page, "from")).toHaveAttribute("aria-invalid", "true");
  await expect(field(page, "to")).toHaveAttribute("aria-invalid", "true");
  // 错误态要有看得见的差异，不只是加了个属性。
  expect(await paint(field(page, "from"))).not.toEqual(idle);
  expect(await paint(field(page, "to"))).not.toEqual(idle);
  await expect(calls.length).toBe(loaded);
  await page.locator("#window-form").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "docs/t009-illegal-window-desktop.png" });

  // 改回合法区间：错误态自己退掉，不用再点一次按钮。
  await field(page, "to").fill("2026-09-17T11:00");
  await expect(hint(page)).toBeHidden();
  await expect(field(page, "from")).not.toHaveAttribute("aria-invalid", "true");
  expect(await paint(field(page, "from"))).toEqual(idle);

  // 窄屏同样就地提示（同一会话换视口，避免重复登录）。
  await page.setViewportSize({ width: 390, height: 844 });
  await field(page, "from").fill("2026-09-17T10:00");
  await field(page, "to").fill("2026-09-17T09:00");
  await page.getByRole("button", { name: "查看这个窗口" }).click();
  await expect(hint(page)).toBeVisible();
  await expect(hint(page)).toHaveText("结束时间要晚于开始时间");
  await page.locator("#window-form").scrollIntoViewIfNeeded();
  await page.screenshot({ path: "docs/t009-illegal-window-mobile.png" });
});

test("合法区间照常查询（回归）", async ({ page }) => {
  await login(page);
  await createChild(page, "时间窗口回归儿童");
  await openReports(page);
  await field(page, "from").fill("2026-09-01T00:00");
  await field(page, "to").fill("2026-09-08T00:00");
  const queried = page.waitForResponse((r) =>
    r.url().includes("/growth-overview"),
  );
  await page.getByRole("button", { name: "查看这个窗口" }).click();
  const url = (await queried).url();
  expect(url).toContain("growth-overview?from=");
  expect(url).toContain("to=");
  await expect(hint(page)).toBeHidden();
  await expect(field(page, "from")).not.toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByRole("heading", { name: "阶段画像与变化" }),
  ).toBeVisible();
});
