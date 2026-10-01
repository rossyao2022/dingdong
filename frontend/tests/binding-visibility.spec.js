import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { shell } from "./support.js";

const pageErrors = new WeakMap();
test.beforeEach(async ({ page }) => {
  const errors = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([]);
});

// Real isolated API/database and Chrome. Transport failure uses offline mode;
// no business response is intercepted or fabricated.
async function api(page, path, options = {}) {
  return page.evaluate(
    async ({ path, options }) => {
      const version = new URL(
        document.querySelector('script[src*="bootstrap.js"]').src,
      ).search;
      return (await import("./api.js" + version)).request(path, options);
    },
    { path, options },
  );
}
async function start(page) {
  await page.goto("/");
  expect(
    (await (await page.request.get("/api/v1/runtime")).json()).sms_mode,
  ).toBe("fixed_code");
  await page
    .getByLabel("手机号", { exact: true })
    .fill("139" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0"));
  await page.locator("#send-code").click();
  await page.getByLabel("验证码", { exact: true }).fill("00000");
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "建立儿童档案" }),
  ).toBeVisible();
  return addChild(page, "绑定可见性合成儿童");
}
async function addChild(page, name) {
  await page.getByLabel("姓名或称呼").fill(name);
  await page.getByRole("button", { name: "保存档案", exact: true }).click();
  await expect(page.locator(".six-islands")).toBeVisible();
  return page.locator("#child-select").inputValue();
}
function makeBound(child, account) {
  expect(child).toMatch(/^[0-9a-f-]{36}$/);
  expect(account.ca_account_id).toMatch(/^ca_[0-9A-Z]+$/);
  shell(
    `from django.conf import settings; from dingdong_ca.core.models import CaAccount; assert settings.DINGDONG_BASE_URL == '' and settings.SMS_MODE == 'fixed_code'; row=CaAccount.objects.get(child_id='${child}',ca_account_id='${account.ca_account_id}',status='active'); row.bind_state='bound'; row.save(update_fields=['bind_state'])`,
  );
}
async function noManagement(page) {
  await expect(page.locator("#main a", { hasText: "管理机器人" })).toHaveCount(
    0,
  );
  await expect(
    page.locator(
      '[data-action="replace-robot"], [data-action="retire-account"]',
    ),
  ).toHaveCount(0);
}
async function visit(page, route) {
  await page.evaluate((route) => {
    location.hash = "#" + route;
  }, route);
}
for (const width of [390, 1280]) {
  test(`${width}px：未绑→待接通→取消→绑定→切儿童→解绑的可见性闭环`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    const child = await start(page);
    await visit(page, "companion");
    await expect(
      page.locator('.robot-entry [data-action="bind-robot"]'),
    ).toBeVisible();
    await expect(
      page.locator('.robot-entry a[href="#exhibition"]'),
    ).toBeVisible();
    await noManagement(page);
    await page.goto(
      `/?nfc_token=visibility-synthetic-${randomUUID()}&robot_ref=OLD-SYNTHETIC-REF#settings`,
    );
    await expect(page.locator("#bind-robot-form")).toBeVisible();
    const pendingResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "确认绑定", exact: true }).click();
    const pending = await (await pendingResponse).json();
    expect(pending.robot_ref).toBe("OLD-SYNTHETIC-REF");
    await expect(page.locator(".account-row")).toContainText("待接通");
    await noManagement(page);
    await expect(
      page.getByRole("button", { name: "继续连接", exact: true }),
    ).toBeVisible();
    await page.locator('[data-action="cancel-robot-connection"]').click();
    await expect(page.locator("#dialog")).not.toContainText("解绑");
    await page.locator('[data-action="confirm-cancel-connection"]').click();
    await expect(page.locator(".account-row")).toContainText("已归档");
    expect(
      (await api(page, `/children/${child}/ca-accounts`)).items.find(
        (row) => row.ca_account_id === pending.ca_account_id,
      ).status,
    ).toBe("retired");
    await page.getByRole("button", { name: "绑定机器人", exact: true }).click();
    await page
      .getByLabel("机器人凭据")
      .fill("visibility-manual-" + randomUUID());
    const boundResponse = page.waitForResponse(
      (r) =>
        r.url().endsWith("/ca-accounts") && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "确认绑定", exact: true }).click();
    const bound = await (await boundResponse).json();
    expect(bound.robot_ref).toBeNull();
    makeBound(child, bound);
    await visit(page, "companion");
    await expect(page.locator(".robot-entry")).toContainText("机器人已绑定");
    await expect(
      page.locator('.robot-entry a[href="#settings"]'),
    ).toContainText("管理机器人");
    await expect(page.locator("#main")).not.toContainText("展会");
    await expect(page.locator("#toast")).not.toHaveClass(/show/, {
      timeout: 10000,
    });
    await page.screenshot({
      path: `${process.env.E2E_SHOTS_DIR || "../deploy/evidence/v0.3.26/shots"}/bound-companion-${width}.png`,
      animations: "disabled",
      fullPage: true,
    });
    await visit(page, "exhibition");
    await expect(page).toHaveURL(/#reports$/);
    await expect(page.locator("#dingdong-growth-report")).toBeVisible();
    await expect(page.locator("#main")).not.toContainText("展会");
    // Synthetic supplier confirmation advances faster than the old issue toast.
    // Capture the settled bound page after that transient notice has expired.
    await expect(page.locator("#toast")).not.toHaveClass(/show/, {
      timeout: 10000,
    });
    await page.screenshot({
      path: `${process.env.E2E_SHOTS_DIR || "../deploy/evidence/v0.3.26/shots"}/bound-reports-${width}.png`,
      animations: "disabled",
      fullPage: true,
    });
    await visit(page, "settings");
    await expect(page.locator('[data-action="replace-robot"]')).toBeVisible();
    await expect(page.locator('[data-action="retire-account"]')).toBeVisible();
    await page
      .getByRole("button", { name: "添加儿童档案", exact: true })
      .click();
    const other = await addChild(page, "未绑另一合成儿童");
    expect(other).not.toBe(child);
    await visit(page, "companion");
    await expect(
      page.locator('.robot-entry a[href="#exhibition"]'),
    ).toBeVisible();
    await noManagement(page);
    await visit(page, "reports");
    await expect(page.locator("#personal-assessments")).toBeVisible();
    await expect(page.locator("#dingdong-growth-report")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "进入展会体验", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: `${process.env.E2E_SHOTS_DIR || "../deploy/evidence/v0.3.26/shots"}/unbound-reports-${width}.png`,
      animations: "disabled",
      fullPage: true,
    });
    await page.locator("#child-select").selectOption(child);
    await expect(page.locator(".six-islands")).toBeVisible();
    await visit(page, "settings");
    await page.locator('[data-action="retire-account"]').click();
    await page.locator('[data-action="confirm-retire"]').click();
    await expect(page.locator('[data-action="retire-account"]')).toHaveCount(0);
    await visit(page, "companion");
    await expect(
      page.locator('.robot-entry a[href="#exhibition"]'),
    ).toBeVisible();
    await noManagement(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
test("连接读取失败不能猜成未绑：个人记录仍可看、展会直达不加载", async ({
  page,
}) => {
  const child = await start(page);
  let exhibitionReads = 0;
  page.on("request", (r) => {
    if (r.url().includes("/exhibition/report")) exhibitionReads++;
  });
  // Actual browser transport outage after successful real login/child creation.
  await page.context().setOffline(true);
  try {
    await visit(page, "reports");
    await expect(page.locator("#main")).toContainText("机器人连接暂时读不到");
    await expect(page.locator("#personal-assessments")).toBeVisible();
    await expect(page.locator("#main")).not.toContainText("展会");
    await noManagement(page);
    await visit(page, "exhibition");
    await expect(page.locator("#main")).toContainText("机器人连接暂时读不到");
    await expect(page.locator("#main")).not.toContainText("展会");
    await expect(page.locator('[data-action="bind-robot"]')).toHaveCount(0);
    expect(exhibitionReads).toBe(0);
  } finally {
    await page.context().setOffline(false);
  }
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "展会体验", exact: true }),
  ).toBeVisible();
});

test("取消弹窗打开后机器人接通：旧取消动作不能解绑新连接", async ({ page }) => {
  const child = await start(page);
  const account = await api(page, `/children/${child}/ca-accounts`, {
    method: "POST",
    body: {
      request_id: randomUUID(),
      nfc_token: "visibility-race-" + randomUUID(),
    },
  });
  await visit(page, "settings");
  await expect(
    page.locator('[data-action="cancel-robot-connection"]'),
  ).toBeVisible();
  await page.locator('[data-action="cancel-robot-connection"]').click();
  await expect(
    page.getByRole("heading", { name: "取消连接", exact: true }),
  ).toBeVisible();
  makeBound(child, account);
  const response = page.waitForResponse(
    (r) => r.url().endsWith("/retire") && r.request().method() === "POST",
  );
  await page.locator('[data-action="confirm-cancel-connection"]').click();
  const rejected = await response;
  expect(rejected.status()).toBe(409);
  expect((await rejected.json()).code).toBe("STATE_CONFLICT");
  const saved = await api(page, "/ca-accounts/" + account.ca_account_id);
  expect(saved.status).toBe("active");
  expect(saved.bind_state).toBe("bound");
});
